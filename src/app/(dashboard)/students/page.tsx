import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import { listStudentsAction, listCoursesForFilterAction } from '@/actions/students';
import { StudentListTable } from '@/components/features/students/StudentListTable';
import { StudentFilterBar } from '@/components/features/students/StudentFilterBar';
import { buttonVariants } from '@/components/ui/button';
import { GraduationCap } from 'lucide-react';
import type { UserRole } from '@prisma/client';

export const metadata = { title: 'Quản lý học sinh' };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const role    = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) redirect('/dashboard');

  const sp       = await searchParams;
  const q        = typeof sp.q        === 'string' ? sp.q        : '';
  const courseId = typeof sp.courseId === 'string' ? sp.courseId : '';
  const page     = typeof sp.page     === 'string' ? Math.max(1, parseInt(sp.page)) : 1;

  const [{ students, total, totalPages }, courses] = await Promise.all([
    listStudentsAction({ q, courseId, page }),
    listCoursesForFilterAction(),
  ]);

  function buildHref(p: number) {
    const params = new URLSearchParams();
    if (q)        params.set('q',        q);
    if (courseId) params.set('courseId', courseId);
    if (p > 1)    params.set('page',     String(p));
    const qs = params.toString();
    return `/students${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Quản lý học sinh</h1>
            <p className="text-sm text-muted-foreground">Tổng: {total} học sinh</p>
          </div>
        </div>
        {(role === 'ADMIN' || role === 'TEACHER') && (
          <Link href="/admin/users/new" className={buttonVariants({})}>
            Thêm tài khoản
          </Link>
        )}
      </div>

      {/* Filter */}
      <StudentFilterBar q={q} courseId={courseId} courses={courses} />

      {/* Table */}
      <StudentListTable students={students} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          {page > 1 && (
            <Link href={buildHref(page - 1)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Trước
            </Link>
          )}
          <span className="text-sm text-muted-foreground">Trang {page} / {totalPages}</span>
          {page < totalPages && (
            <Link href={buildHref(page + 1)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Sau
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
