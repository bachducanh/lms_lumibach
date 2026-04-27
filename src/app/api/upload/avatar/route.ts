import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { minioClient, BUCKET_AVATARS, ensureBucket, getPublicUrl, isMinioConfigured } from '@/lib/storage';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

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

  if (!file) return NextResponse.json({ error: 'Không có file' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type))
    return NextResponse.json({ error: 'Chỉ chấp nhận ảnh JPG, PNG, WebP, GIF' }, { status: 400 });
  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: 'Ảnh tối đa 5 MB' }, { status: 400 });

  try {
    await ensureBucket(BUCKET_AVATARS);

    const ext = file.name.split('.').pop() ?? 'jpg';
    const objectName = `${session.user.id}/${randomBytes(8).toString('hex')}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await minioClient.putObject(BUCKET_AVATARS, objectName, buffer, buffer.length, {
      'Content-Type': file.type,
    });

    const url = getPublicUrl(BUCKET_AVATARS, objectName);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { avatar: url },
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error('[AVATAR UPLOAD]', err);
    return NextResponse.json({ error: 'Upload thất bại, thử lại sau' }, { status: 500 });
  }
}
