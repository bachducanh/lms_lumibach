import { NextRequest, NextResponse } from 'next/server';
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
import { hasMinRole } from '@/lib/permissions';
import type { UserRole } from '@lumibach/db';

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }
  if (!hasMinRole(role, 'TEACHER')) {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }
  if (!isMinioConfigured()) {
    return NextResponse.json({ error: 'Storage chưa được cấu hình' }, { status: 503 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const lessonId = formData.get('lessonId') as string | null;

  if (!file) return NextResponse.json({ error: 'Không có file' }, { status: 400 });
  if (!lessonId) return NextResponse.json({ error: 'Thiếu lessonId' }, { status: 400 });

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'Định dạng file không được hỗ trợ' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File tối đa 20 MB' }, { status: 400 });
  }

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return NextResponse.json({ error: 'Bài giảng không tồn tại' }, { status: 404 });

  try {
    await ensureBucket(BUCKET_FILES);

    const objectName = `lesson-attachments/${lessonId}/${randomBytes(8).toString('hex')}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await minioClient.putObject(BUCKET_FILES, objectName, buffer, buffer.length, {
      'Content-Type': file.type,
    });

    const url = getPublicUrl(BUCKET_FILES, objectName);

    const attachment = await prisma.lessonAttachment.create({
      data: {
        lessonId,
        name: file.name,
        url,
        mimeType: file.type,
        size: file.size,
        uploadedBy: session.user.id,
      },
    });

    return NextResponse.json({ attachment });
  } catch (err) {
    console.error('[LESSON FILE UPLOAD]', err);
    return NextResponse.json({ error: 'Upload thất bại, thử lại sau' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }
  if (!hasMinRole(role, 'TEACHER')) {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const attachmentId = searchParams.get('id');
  if (!attachmentId) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

  const attachment = await prisma.lessonAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 });

  try {
    // Extract object name from URL
    const urlObj = new URL(attachment.url);
    const objectName = urlObj.pathname.replace(/^\/[^/]+\//, ''); // strip /bucket/

    await minioClient.removeObject(BUCKET_FILES, objectName);
    await prisma.lessonAttachment.delete({ where: { id: attachmentId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[LESSON FILE DELETE]', err);
    return NextResponse.json({ error: 'Xoá thất bại' }, { status: 500 });
  }
}
