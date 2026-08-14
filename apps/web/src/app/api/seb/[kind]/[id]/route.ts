import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { minioClient, toStoragePath } from '@/lib/storage';
import { withSebStartUrl } from '@/lib/seb-config';
import { requestOrigin, type SebActivityKind } from '@/lib/seb';

// Endpoint này phục vụ chính Safe Exam Browser — SEB tải file cấu hình bằng
// tiến trình riêng, không mang theo cookie phiên của học sinh, nên không thể
// yêu cầu đăng nhập ở đây. Mức lộ thông tin bằng đúng cách cũ (file .seb nằm
// công khai trên MinIO), chỉ khác là startURL được cá thể hoá theo hoạt động.
export const dynamic = 'force-dynamic';

const KINDS: Record<string, SebActivityKind> = {
  quiz: 'quiz',
  'practice-test': 'practice-test',
};

type Activity = {
  title: string;
  sebEnabled: boolean;
  sebConfigUrl: string | null;
  sebConfigName: string | null;
  /** null khi hoạt động là bản mẫu trong ngân hàng nội dung của danh mục. */
  course: { slug: string } | null;
};

async function findActivity(kind: SebActivityKind, id: string): Promise<Activity | null> {
  const select = {
    title: true,
    sebEnabled: true,
    sebConfigUrl: true,
    sebConfigName: true,
    course: { select: { slug: true } },
  } as const;

  return kind === 'quiz'
    ? prisma.quiz.findFirst({ where: { id, deletedAt: null }, select })
    : prisma.practiceTest.findFirst({ where: { id, deletedAt: null }, select });
}

/** `/storage/<bucket>/<object...>` (hoặc URL đầy đủ trên miền media) → { bucket, objectName } */
function parseStorageUrl(url: string): { bucket: string; objectName: string } | null {
  const path = toStoragePath(url);
  const m = path?.match(/^\/storage\/([^/]+)\/(.+)$/);
  if (!m?.[1] || !m[2]) return null;
  return { bucket: m[1], objectName: m[2] };
}

async function readObject(bucket: string, objectName: string): Promise<Buffer> {
  const stream = await minioClient.getObject(bucket, objectName);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ kind: string; id: string }> }
) {
  const { kind: rawKind, id: rawId } = await ctx.params;

  const kind = KINDS[rawKind];
  if (!kind) return NextResponse.json({ error: 'Loại hoạt động không hợp lệ' }, { status: 404 });

  // Link mang đuôi .seb để Windows/SEB nhận đúng loại file.
  const id = rawId.replace(/\.seb$/i, '');

  const activity = await findActivity(kind, id);
  // `course` null = bản mẫu trong ngân hàng nội dung của danh mục: không có lớp
  // nên không dựng được đường dẫn để SEB mở, và cũng không ai làm bài ở đó.
  if (!activity || !activity.sebEnabled || !activity.sebConfigUrl || !activity.course) {
    return NextResponse.json({ error: 'Không tìm thấy cấu hình SEB' }, { status: 404 });
  }
  const course = activity.course;

  const origin = requestOrigin(req.headers);
  if (!origin) return NextResponse.json({ error: 'Không xác định được origin' }, { status: 400 });

  // Trỏ SEB vào trang đăng nhập kèm đích đến: SEB xoá cookie mỗi phiên nên học
  // sinh luôn phải đăng nhập lại, và đăng nhập xong là vào thẳng hoạt động.
  const activityPath =
    kind === 'quiz'
      ? `/courses/${course.slug}/quizzes/${id}`
      : `/courses/${course.slug}/practice-tests/${id}`;
  const startUrl = `${origin}/login?next=${encodeURIComponent(activityPath)}`;

  const storage = parseStorageUrl(activity.sebConfigUrl);
  if (!storage) {
    // Cấu hình cũ lưu URL tuyệt đối → không sửa được, trả về nguyên bản.
    return NextResponse.redirect(new URL(activity.sebConfigUrl, origin));
  }

  let template: Buffer;
  try {
    template = await readObject(storage.bucket, storage.objectName);
  } catch (err) {
    console.error('[SEB CONFIG]', err);
    return NextResponse.json({ error: 'Không đọc được file cấu hình' }, { status: 502 });
  }

  // File đặt mật khẩu thì không sửa được — vẫn phục vụ bản gốc để giáo viên
  // dùng được, chỉ là học sinh phải tự điều hướng như trước.
  const patched = withSebStartUrl(template, startUrl, origin) ?? template;

  const fileName = (activity.sebConfigName ?? `${kind}-${id}.seb`).replace(/[^\w.-]+/g, '_');

  return new NextResponse(new Uint8Array(patched), {
    headers: {
      'Content-Type': 'application/seb',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
