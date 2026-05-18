import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { auth } from '@/auth';
import {
  minioClient,
  BUCKET_FILES,
  ensureBucket,
  getPublicUrl,
  isMinioConfigured,
} from '@/lib/storage';
import type { UserRole } from '@lumibach/db';

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB — Scratch projects with assets can be large

// kind: 'starter' (teacher uploads starter .sb3) or 'submission' (student submits .sb3)
const ALLOWED_KINDS = new Set(['starter', 'submission']);

function isSb3(file: File): boolean {
  // .sb3 is a ZIP under the hood
  if (file.name.toLowerCase().endsWith('.sb3')) return true;
  if (file.type === 'application/x.scratch.sb3') return true;
  if (file.type === 'application/zip' && file.name.toLowerCase().endsWith('.sb3')) return true;
  return false;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }
  if (!isMinioConfigured()) {
    return NextResponse.json({ error: 'Storage chưa được cấu hình' }, { status: 503 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const kind = (formData.get('kind') as string | null) ?? 'submission';
  const exerciseId = formData.get('exerciseId') as string | null;

  if (!file) return NextResponse.json({ error: 'Không có file' }, { status: 400 });
  if (!ALLOWED_KINDS.has(kind))
    return NextResponse.json({ error: 'Kind không hợp lệ' }, { status: 400 });
  if (!isSb3(file)) return NextResponse.json({ error: 'Cần file Scratch (.sb3)' }, { status: 400 });
  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: 'File tối đa 50 MB' }, { status: 400 });

  // Only TEACHER+ can upload starter
  if (kind === 'starter' && !['ADMIN', 'TEACHER', 'TA'].includes(role ?? '')) {
    return NextResponse.json({ error: 'Không có quyền tải starter' }, { status: 403 });
  }

  try {
    await ensureBucket(BUCKET_FILES);

    const folder = kind === 'starter' ? 'scratch-starters' : 'scratch-submissions';
    const subPath = exerciseId ? `${exerciseId}/` : '';
    const objectName = `${folder}/${subPath}${randomBytes(10).toString('hex')}.sb3`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await minioClient.putObject(BUCKET_FILES, objectName, buffer, buffer.length, {
      'Content-Type': 'application/x.scratch.sb3',
    });

    const url = getPublicUrl(BUCKET_FILES, objectName);
    return NextResponse.json({ url, size: file.size, name: file.name });
  } catch (err) {
    console.error('[SCRATCH UPLOAD]', err);
    return NextResponse.json({ error: 'Upload thất bại, thử lại sau' }, { status: 500 });
  }
}
