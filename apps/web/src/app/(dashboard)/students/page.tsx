import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import { ApiError, apiServerClient } from '@/lib/api-client';
import { StudentListTable } from '@/components/features/students/StudentListTable';
import { StudentFilterBar } from '@/components/features/students/StudentFilterBar';
import { buttonVariants } from '@/components/ui/button';
import { AlertTriangle, GraduationCap, RefreshCw } from 'lucide-react';
import type { UserRole } from '@lumibach/db';
import type { StudentRow } from '@lumibach/types';

export const metadata = { title: 'Quản lý học sinh' };

type StudentsData = {
  students: StudentRow[];
  total: number;
  totalPages: number;
};

type StudentsResult = { ok: true; data: StudentsData } | { ok: false; message: string };

function getStudentsErrorMessage(err: unknown) {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.';
    if (err.status === 403) return 'Bạn không có quyền xem danh sách học sinh.';
    return err.message;
  }
  return 'Không kết nối được API. Kiểm tra backend ở cổng 4000 rồi tải lại trang.';
}

function StudentsLoadError({ message, retryHref }: { message: string; retryHref: string }) {
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border px-5 py-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Không tải được danh sách học sinh</p>
            <p className="mt-1 text-sm opacity-90">{message}</p>
          </div>
        </div>
        <Link href={retryHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tải lại
        </Link>
      </div>
    </div>
  );
}

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
  const [studentsResult, courses] = await Promise.all([
    api
      .get<StudentsData>(`/users/students?${params.toString()}`)
      .then((data): StudentsResult => ({ ok: true, data }))
      .catch(
        (err: unknown): StudentsResult => ({ ok: false, message: getStudentsErrorMessage(err) })
      ),
    api
      .get<{ id: string; name: string; slug: string }[]>('/users/students/courses-filter')
      .catch(() => [] as { id: string; name: string; slug: string }[]),
  ]);
  const studentsData = studentsResult.ok
    ? studentsResult.data
    : { students: [] as StudentRow[], total: 0, totalPages: 0 };
  const { students, total, totalPages } = studentsData;
  const isFiltered = Boolean(q || courseId);
  const emptyTitle = isFiltered
    ? 'Không tìm thấy học sinh phù hợp'
    : role === 'ADMIN'
      ? 'Chưa có tài khoản học sinh'
      : 'Chưa có học sinh trong phạm vi phụ trách';
  const emptyDescription = isFiltered
    ? 'Thử đổi từ khóa tìm kiếm hoặc bỏ lọc khóa học.'
    : role === 'ADMIN'
      ? 'Tạo tài khoản học sinh mới hoặc import danh sách để bắt đầu quản lý.'
      : courses.length === 0
        ? 'Bạn chưa được phân công khóa học nào, nên hệ thống chưa có học sinh để hiển thị.'
        : 'Các khóa học bạn phụ trách hiện chưa có học sinh tham gia.';

  function buildHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (courseId) params.set('courseId', courseId);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/students${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="lb-stagger space-y-6">
      {/* Header */}
      <div
        className="flex flex-wrap items-start justify-between gap-3"
        style={{ ['--i' as string]: 0 }}
      >
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-xl">
            <GraduationCap className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Quản lý học sinh</h1>
            <p className="text-muted-foreground text-sm">
              {studentsResult.ok ? `Tổng: ${total} học sinh` : 'Chưa tải được dữ liệu học sinh'}
            </p>
          </div>
        </div>
        {role === 'ADMIN' && (
          <Link href="/admin/users/new" className={buttonVariants({})}>
            Thêm tài khoản
          </Link>
        )}
      </div>

      {/* Filter */}
      <div style={{ ['--i' as string]: 1 }}>
        <StudentFilterBar q={q} courseId={courseId} courses={courses} />
      </div>

      {/* Table */}
      <div style={{ ['--i' as string]: 2 }}>
        {studentsResult.ok ? (
          <StudentListTable
            students={students}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
          />
        ) : (
          <StudentsLoadError message={studentsResult.message} retryHref={buildHref(page)} />
        )}
      </div>

      {/* Pagination */}
      {studentsResult.ok && totalPages > 1 && (
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
