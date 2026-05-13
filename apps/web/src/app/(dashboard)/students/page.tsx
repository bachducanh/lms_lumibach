import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import { apiServerClient } from '@/lib/api-client';
import { StudentListTable } from '@/components/features/students/StudentListTable';
import { StudentFilterBar } from '@/components/features/students/StudentFilterBar';
import { buttonVariants } from '@/components/ui/button';
import { GraduationCap } from 'lucide-react';
import type { UserRole } from '@lumibach/db';
import type { StudentRow } from '@lumibach/types';

export const metadata = { title: 'Quản lý học sinh' };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) redirect('/dashboard');

  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q : '';
  const courseId = typeof sp.courseId === 'string' ? sp.courseId : '';
  const page = typeof sp.page === 'string' ? Math.max(1, parseInt(sp.page)) : 1;

  const api = apiServerClient(await cookies());
  const params = new URLSearchParams({ page: String(page) });
  if (q) params.set('q', q);
  if (courseId) params.set('courseId', courseId);
  const [studentsData, courses] = await Promise.all([
    api
      .get<{
        students: StudentRow[];
        total: number;
        totalPages: number;
      }>(`/users/students?${params.toString()}`)
      .catch(() => ({ students: [] as StudentRow[], total: 0, totalPages: 0 })),
    api
      .get<{ id: string; name: string; slug: string }[]>('/users/students/courses-filter')
      .catch(() => [] as { id: string; name: string; slug: string }[]),
  ]);
  const { students, total, totalPages } = studentsData;

  function buildHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (courseId) params.set('courseId', courseId);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/students${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-xl">
            <GraduationCap className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Quản lý học sinh</h1>
            <p className="text-muted-foreground text-sm">Tổng: {total} học sinh</p>
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
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={buildHref(page - 1)}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Trước
            </Link>
          )}
          <span className="text-muted-foreground text-sm">
            Trang {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildHref(page + 1)}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Sau
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
