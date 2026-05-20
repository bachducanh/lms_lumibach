import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import {
  minioClient,
  BUCKET_FILES,
  ensureBucket,
  getPublicUrl,
  isMinioConfigured,
} from '@/lib/storage';

// Mặc định khi giáo viên không đặt giới hạn riêng cho bài tập.
const DEFAULT_MAX_MB = 50;
// Trần cứng để tránh lạm dụng dù giáo viên đặt giới hạn lớn.
const HARD_CAP_MB = 200;

// Chỉ ảnh (trừ SVG), audio và PDF được xem trực tiếp (inline) trên trình duyệt.
// Mọi loại khác buộc tải xuống (attachment) để tránh XSS từ file HTML/SVG do học sinh nộp.
function dispositionType(mime: string): 'inline' | 'attachment' {
  const m = (mime || '').toLowerCase();
  if (m === 'application/pdf') return 'inline';
  if (m.startsWith('audio/')) return 'inline';
  if (m.startsWith('image/') && m !== 'image/svg+xml') return 'inline';
  return 'attachment';
}

function buildContentDisposition(disposition: 'inline' | 'attachment', filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function safeExt(name: string): string {
  const raw = name.includes('.') ? (name.split('.').pop() ?? '') : '';
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }
  if (!isMinioConfigured()) {
    return NextResponse.json({ error: 'Storage chưa được cấu hình' }, { status: 503 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const assignmentId = formData.get('assignmentId') as string | null;

  if (!file) return NextResponse.json({ error: 'Không có file' }, { status: 400 });
  if (!assignmentId) return NextResponse.json({ error: 'Thiếu assignmentId' }, { status: 400 });

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, deletedAt: null },
    select: { id: true, status: true, maxFileSizeMb: true },
  });
  if (!assignment) return NextResponse.json({ error: 'Bài tập không tồn tại' }, { status: 404 });
  if (assignment.status !== 'PUBLISHED')
    return NextResponse.json({ error: 'Bài tập chưa được đăng' }, { status: 403 });

  const limitMb = Math.min(assignment.maxFileSizeMb ?? DEFAULT_MAX_MB, HARD_CAP_MB);
  if (file.size > limitMb * 1024 * 1024)
    return NextResponse.json({ error: `File tối đa ${limitMb} MB` }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: 'File rỗng' }, { status: 400 });

  const mimeType = file.type || 'application/octet-stream';

  try {
    await ensureBucket(BUCKET_FILES);

    const ext = safeExt(file.name);
    const objectName = `submissions/${assignmentId}/${session.user.id}/${randomBytes(10).toString('hex')}${ext ? `.${ext}` : ''}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await minioClient.putObject(BUCKET_FILES, objectName, buffer, buffer.length, {
      'Content-Type': mimeType,
      'Content-Disposition': buildContentDisposition(dispositionType(mimeType), file.name),
    });

    const url = getPublicUrl(BUCKET_FILES, objectName);
    return NextResponse.json({ file: { name: file.name, url, mimeType, size: file.size } });
  } catch (err) {
    console.error('[SUBMISSION FILE UPLOAD]', err);
    return NextResponse.json({ error: 'Upload thất bại, thử lại sau' }, { status: 500 });
  }
}

// Xoá file vừa upload nhưng chưa nộp (học sinh bỏ chọn trước khi submit).
// Chỉ cho xoá file nằm trong thư mục của chính mình.
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Thiếu url' }, { status: 400 });

  const prefix = `/storage/${BUCKET_FILES}/`;
  if (!url.startsWith(prefix))
    return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 });

  const objectName = url.slice(prefix.length);
  // Chỉ được xoá file trong thư mục submissions của chính user.
  if (!objectName.startsWith(`submissions/`) || !objectName.includes(`/${session.user.id}/`))
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  try {
    await minioClient.removeObject(BUCKET_FILES, objectName);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[SUBMISSION FILE DELETE]', err);
    return NextResponse.json({ error: 'Xoá thất bại' }, { status: 500 });
  }
}
