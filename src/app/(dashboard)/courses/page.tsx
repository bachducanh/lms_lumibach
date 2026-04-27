import Link from 'next/link';
import { auth } from '@/auth';
import { buttonVariants } from '@/components/ui/button';
import { CourseCard } from '@/components/features/courses/CourseCard';
import { CourseFilterBar } from '@/components/features/courses/CourseFilterBar';
import { listCoursesAction } from '@/actions/courses';
import { Plus, BookOpen } from 'lucide-react';
import type { UserRole } from '@prisma/client';

export const metadata = { title: 'Khoá học' };

const PAGE_SIZE = 12;

function buildPageHref(base: Record<string, string>, page: number) {
  const sp = new URLSearchParams({ ...base, page: String(page) });
  return `/courses?${sp.toString()}`;
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  const canCreate = role === 'ADMIN' || role === 'TEACHER';

  const sp = await searchParams;
  const q      = typeof sp.q      === 'string' ? sp.q      : '';
  const status = typeof sp.status === 'string' ? sp.status : '';
  const page   = typeof sp.page   === 'string' ? Math.max(1, parseInt(sp.page)) : 1;

  const { courses, total, totalPages } = await listCoursesAction({ q, status, page, pageSize: PAGE_SIZE });

  const baseParams = { ...(q ? { q } : {}), ...(status ? { status } : {}) };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Học tập</p>
          <h1 className="text-3xl font-bold tracking-tight">Khoá học</h1>
          <p className="text-sm text-muted-foreground">{total} khoá học</p>
        </div>
        {canCreate && (
          <Link href="/courses/new" className={buttonVariants({ size: 'sm' })}>
            <Plus className="h-4 w-4 mr-1.5" />
            Tạo khoá học
          </Link>
        )}
      </div>

      <CourseFilterBar role={role} />

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-24 text-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <BookOpen className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Chưa có khoá học nào</p>
            <p className="text-sm text-muted-foreground mt-1">
              {canCreate ? 'Tạo khoá học đầu tiên để bắt đầu.' : 'Bạn chưa được thêm vào khoá học nào.'}
            </p>
          </div>
          {canCreate && (
            <Link href="/courses/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo khoá học
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Link href={buildPageHref(baseParams, page - 1)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              ← Trước
            </Link>
          )}
          <span className="flex items-center text-sm text-muted-foreground px-2">
            Trang {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link href={buildPageHref(baseParams, page + 1)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Sau →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
