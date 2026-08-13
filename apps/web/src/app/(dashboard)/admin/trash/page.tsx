import { cookies } from 'next/headers';
import { AlertTriangle } from 'lucide-react';
import { apiServerClient, ApiError } from '@/lib/api-client';
import { TrashList } from '@/components/features/courses/TrashList';
import { TrashedActivityList } from '@/components/features/courses/TrashedActivityList';
import type { TrashedActivityItem, TrashedCourseItem } from '@lumibach/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Thùng rác' };

export default async function AdminTrashPage() {
  const api = apiServerClient(await cookies());
  let courses: TrashedCourseItem[] = [];
  let activities: TrashedActivityItem[] = [];
  let loadError: string | null = null;

  try {
    [courses, activities] = await Promise.all([
      api.get<TrashedCourseItem[]>('/courses/trash'),
      api.get<TrashedActivityItem[]>('/courses/trash/activities'),
    ]);
  } catch (err) {
    loadError = err instanceof ApiError ? err.message : 'Không tải được thùng rác.';
  }

  return (
    <div className="lb-stagger space-y-5">
      <div style={{ ['--i' as string]: 0 }}>
        <h1 className="text-2xl font-bold">Thùng rác</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Khoá học đã xoá được giữ 30 ngày kể từ ngày xoá, sau đó tự xoá vĩnh viễn. Trong thời gian
          này toàn bộ nội dung và học sinh vẫn được giữ nguyên để khôi phục.
        </p>
      </div>

      <div style={{ ['--i' as string]: 1 }}>
        {loadError ? (
          <div className="border-destructive/30 bg-destructive/5 rounded-xl border border-dashed p-8 text-center">
            <AlertTriangle className="text-destructive mx-auto h-8 w-8" />
            <p className="mt-3 font-semibold">Không tải được thùng rác</p>
            <p className="text-muted-foreground mt-1 text-sm">{loadError}</p>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-wide uppercase">Khoá học đã xoá</h2>
              <TrashList courses={courses} />
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold tracking-wide uppercase">Hoạt động đã xoá</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Bài tập, quiz, bài code và đề ôn bị xoá khỏi chương hoặc khỏi tab riêng. Khôi phục
                  xong chúng hiện lại ở tab tương ứng, cần tự xếp lại vào chương.
                </p>
              </div>
              <TrashedActivityList activities={activities} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
