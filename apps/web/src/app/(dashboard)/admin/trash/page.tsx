import { cookies } from 'next/headers';
import { AlertTriangle } from 'lucide-react';
import { apiServerClient, ApiError } from '@/lib/api-client';
import { TrashList } from '@/components/features/courses/TrashList';
import type { TrashedCourseItem } from '@lumibach/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Thùng rác' };

export default async function AdminTrashPage() {
  const api = apiServerClient(await cookies());
  let courses: TrashedCourseItem[] = [];
  let loadError: string | null = null;

  try {
    courses = await api.get<TrashedCourseItem[]>('/courses/trash');
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
          <TrashList courses={courses} />
        )}
      </div>
    </div>
  );
}
