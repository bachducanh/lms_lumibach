import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import {
  minioClient,
  BUCKET_FILES,
  ensureBucket,
  getPublicUrl,
  isMinioConfigured,
} from '@/lib/storage';
import type { UserRole } from '@lumibach/db';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }
  if (role !== 'ADMIN' && role !== 'TEACHER') {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  }
  if (!isMinioConfigured()) {
    return NextResponse.json({ error: 'Storage chưa được cấu hình' }, { status: 503 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const courseId = formData.get('courseId') as string | null;

  if (!file) return NextResponse.json({ error: 'Không có file' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type))
    return NextResponse.json({ error: 'Chỉ chấp nhận ảnh JPG, PNG, WebP' }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Ảnh tối đa 5 MB' }, { status: 400 });

  try {
    await ensureBucket(BUCKET_FILES);

    const ext = file.name.split('.').pop() ?? 'jpg';
    const objectName = `thumbnails/${randomBytes(8).toString('hex')}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await minioClient.putObject(BUCKET_FILES, objectName, buffer, buffer.length, {
      'Content-Type': file.type,
    });

    const url = getPublicUrl(BUCKET_FILES, objectName);

    if (courseId) {
      const updated = await prisma.course.update({
        where: { id: courseId },
        data: { thumbnail: url },
        select: { slug: true },
      });
      revalidatePath('/courses', 'layout');
      revalidatePath(`/courses/${updated.slug}`);
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error('[THUMBNAIL UPLOAD]', err);
    return NextResponse.json({ error: 'Upload thất bại, thử lại sau' }, { status: 500 });
  }
}
