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
import { hasMinRole } from '@/lib/permissions';
import type { UserRole } from '@lumibach/db';

const MAX_SIZE = 50 * 1024 * 1024;

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
  const courseId = formData.get('courseId') as string | null;

  if (!file) return NextResponse.json({ error: 'Không có file' }, { status: 400 });
  if (!courseId) return NextResponse.json({ error: 'Thiếu courseId' }, { status: 400 });
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Chỉ hỗ trợ file PDF' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File tối đa 50 MB' }, { status: 400 });
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { ownerId: true },
  });
  if (!course) return NextResponse.json({ error: 'Khoá học không tồn tại' }, { status: 404 });
  if (role !== 'ADMIN' && course.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Không có quyền quản lý khoá học này' }, { status: 403 });
  }

  try {
    await ensureBucket(BUCKET_FILES);

    const objectName = `practice-tests/${courseId}/${randomBytes(10).toString('hex')}.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await minioClient.putObject(BUCKET_FILES, objectName, buffer, buffer.length, {
      'Content-Type': 'application/pdf',
    });

    return NextResponse.json({
      file: {
        url: getPublicUrl(BUCKET_FILES, objectName),
        name: file.name,
        mimeType: 'application/pdf',
        size: file.size,
      },
    });
  } catch (err) {
    console.error('[PRACTICE TEST PDF UPLOAD]', err);
    return NextResponse.json({ error: 'Upload thất bại, thử lại sau' }, { status: 500 });
  }
}
