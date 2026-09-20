import { cookies } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/auth';
import { apiServerClient, ApiError } from '@/lib/api-client';
import { buttonVariants } from '@/components/ui/button';
import { CourseCard } from '@/components/features/courses/CourseCard';
import { CourseFilterBar } from '@/components/features/courses/CourseFilterBar';
import { Plus, BookOpen, AlertTriangle, RefreshCw } from 'lucide-react';
import type { UserRole } from '@lumibach/db';
import type { CourseListItem } from '@lumibach/types';

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
  const canCreate = role === 'ADMIN';

  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q : '';
  const status = typeof sp.status === 'string' ? sp.status : '';
  const categoryId = typeof sp.categoryId === 'string' ? sp.categoryId : '';
  const includeSubcategories =
    typeof sp.includeSubcategories === 'string' ? sp.includeSubcategories : '';
  const page = typeof sp.page === 'string' ? Math.max(1, parseInt(sp.page)) : 1;

  const api = apiServerClient(await cookies());
  const qp = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (q) qp.set('q', q);
  if (status) qp.set('status', status);
  if (categoryId) qp.set('categoryId', categoryId);
  if (includeSubcategories) qp.set('includeSubcategories', includeSubcategories);
  let courses: CourseListItem[] = [];
  let total = 0;
  let totalPages = 0;
  let loadError: string | null = null;

  try {
    const data = await api.get<{
      courses: CourseListItem[];
      total: number;
      totalPages: number;
    }>(`/courses?${qp.toString()}`);
    courses = data.courses;
    total = data.total;
    totalPages = data.totalPages;
  } catch (err) {
    loadError =
      err instanceof ApiError ? err.message : 'Không tải được danh sách khoá học từ máy chủ.';
  }

  const baseParams = {
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(includeSubcategories ? { includeSubcategories } : {}),
  };

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-primary text-sm font-bold">Học tập</p>
          <h1 className="font-heading text-3xl font-bold sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
            Khoá học
          </h1>
          <p className="text-muted-foreground text-sm">
            {total > 0 ? (
              <span>
                <span className="text-foreground font-semibold">{total}</span> khoá học
              </span>
            ) : (
              'Chưa có khoá học nào'
            )}
          </p>
        </div>

        {canCreate && (
          <Link
            href="/courses/new"
            className="bg-primary text-primary-foreground inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-6 text-sm font-semibold transition-colors hover:bg-[#b80043]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Tạo khoá học
          </Link>
        )}
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <div className="mb-6">
        <CourseFilterBar role={role} />
      </div>

      {/* ── Course grid ────────────────────────────────────── */}
      {loadError ? (
        <div className="border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-20 text-center">
          <div className="bg-destructive/10 flex h-14 w-14 items-center justify-center rounded-xl">
            <AlertTriangle className="text-destructive h-7 w-7" />
          </div>
          <div>
            <p className="text-foreground font-semibold">Không tải được danh sách khoá học</p>
            <p className="text-muted-foreground mt-1 text-sm">{loadError}</p>
          </div>
          <Link href="/courses" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Thử lại
          </Link>
        </div>
      ) : courses.length === 0 ? (
        <div className="border-border bg-card/50 flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-24 text-center">
          <div className="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-xl">
            <BookOpen className="text-primary h-8 w-8" aria-hidden />
          </div>
          <div>
            <p className="text-foreground font-semibold">Chưa có khoá học nào</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {canCreate
                ? 'Tạo khoá học đầu tiên để bắt đầu.'
                : 'Bạn chưa được thêm vào khoá học nào.'}
            </p>
          </div>
          {canCreate && (
            <Link
              href="/courses/new"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Tạo khoá học
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {page > 1 && (
            <Link
              href={buildPageHref(baseParams, page - 1)}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              ← Trước
            </Link>
          )}
          <span className="border-border bg-card text-muted-foreground flex items-center rounded-lg border px-4 font-mono text-sm">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildPageHref(baseParams, page + 1)}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Sau →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
