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

/**
 * Cùng luật với CategoryBankAccessService ở apps/api: ADMIN soạn được mọi danh
 * mục; giáo viên soạn được danh mục nằm trên đường dẫn của một khoá họ quản lý.
 *
 * Phải cài lại ở đây vì tuyến upload này chạy trong Next.js, không đi qua API
 * NestJS. Nới lỏng nó là mở đường ghi file vào kho của người khác.
 */
async function canManageBank(
  userId: string,
  role: UserRole | undefined,
  bankCategoryId: string
): Promise<boolean> {
  if (role === 'ADMIN') return true;
  if (role !== 'TEACHER') return false;

  const courses = await prisma.course.findMany({
    where: {
      deletedAt: null,
      OR: [{ ownerId: userId }, { coTeachers: { some: { userId } } }],
    },
    select: { categoryId: true },
  });

  for (const start of new Set(courses.map((c) => c.categoryId))) {
    let cursor: string | null = start;
    for (let depth = 0; cursor && depth < 50; depth++) {
      if (cursor === bankCategoryId) return true;
      const node: { parentId: string | null } | null = await prisma.courseCategory.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = node?.parentId ?? null;
    }
  }
  return false;
}

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
  // Đề soạn thẳng trong ngân hàng nội dung không thuộc lớp nào; nó gửi
  // bankCategoryId thay cho courseId.
  const bankCategoryId = formData.get('bankCategoryId') as string | null;

  if (!file) return NextResponse.json({ error: 'Không có file' }, { status: 400 });
  if (!courseId && !bankCategoryId) {
    return NextResponse.json({ error: 'Thiếu courseId hoặc bankCategoryId' }, { status: 400 });
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Chỉ hỗ trợ file PDF' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File tối đa 50 MB' }, { status: 400 });
  }

  if (courseId) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        ownerId: true,
        coTeachers: { where: { userId: session.user.id }, select: { id: true } },
      },
    });
    if (!course) return NextResponse.json({ error: 'Khoá học không tồn tại' }, { status: 404 });
    const canManage =
      role === 'ADMIN' || course.ownerId === session.user.id || course.coTeachers.length > 0;
    if (!canManage) {
      return NextResponse.json({ error: 'Không có quyền quản lý khoá học này' }, { status: 403 });
    }
  } else if (!(await canManageBank(session.user.id, role, bankCategoryId!))) {
    return NextResponse.json(
      { error: 'Bạn không soạn được kho của danh mục này' },
      { status: 403 }
    );
  }

  try {
    await ensureBucket(BUCKET_FILES);

    const scope = courseId ?? `bank-${bankCategoryId}`;
    const objectName = `practice-tests/${scope}/${randomBytes(10).toString('hex')}.pdf`;
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
