import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { auth } from '@/auth';
import {
  minioClient,
  BUCKET_FILES,
  ensureBucket,
  getPublicUrl,
  isMinioConfigured,
} from '@/lib/storage';
import { hasMinRole } from '@/lib/permissions';
import type { UserRole } from '@lumibach/db';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  if (!session?.user?.id) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (!hasMinRole(role, 'TEACHER'))
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  if (!isMinioConfigured())
    return NextResponse.json({ error: 'Storage chưa được cấu hình' }, { status: 503 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) return NextResponse.json({ error: 'Không có file' }, { status: 400 });

  const ext = ALLOWED[file.type];
  if (!ext)
    return NextResponse.json({ error: 'Chỉ chấp nhận ảnh JPEG, PNG, GIF, WebP' }, { status: 400 });
  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: 'Ảnh tối đa 10 MB' }, { status: 400 });

  try {
    await ensureBucket(BUCKET_FILES);
    const objectName = `editor-images/${session.user.id}/${randomBytes(8).toString('hex')}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await minioClient.putObject(BUCKET_FILES, objectName, buffer, buffer.length, {
      'Content-Type': file.type,
    });
    const url = getPublicUrl(BUCKET_FILES, objectName);
    return NextResponse.json({ url });
  } catch (err) {
    console.error('[EDITOR IMAGE UPLOAD]', err);
    return NextResponse.json({ error: 'Upload thất bại, thử lại sau' }, { status: 500 });
  }
}
