import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Dọn khoá học đã quá 30 ngày trong thùng rác. Gọi bằng cron mỗi ngày.
// Bảo vệ bằng CRON_SECRET trong env, giống /api/cron/due-soon.
//
// Việc dọn thật nằm ở NestJS (cần xoá Lesson + file MinIO theo đúng thứ tự),
// nên route này chỉ chuyển tiếp secret sang đó thay vì đụng thẳng vào DB.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base =
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:4000/api/v1';

  try {
    const res = await fetch(`${base}/courses/purge-expired`, {
      method: 'POST',
      headers: { 'x-cron-secret': process.env.CRON_SECRET },
      cache: 'no-store',
    });
    const body = await res.json();
    return NextResponse.json(body, { status: res.status });
  } catch (err) {
    console.error('[CRON PURGE TRASH]', err);
    return NextResponse.json({ error: 'Không gọi được API dọn thùng rác' }, { status: 502 });
  }
}
