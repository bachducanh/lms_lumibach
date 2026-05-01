import Link from 'next/link';
import { auth } from '@/auth';
import { buttonVariants } from '@/components/ui/button';
import { CourseCard } from '@/components/features/courses/CourseCard';
import { CourseFilterBar } from '@/components/features/courses/CourseFilterBar';
import { listCoursesAction } from '@/actions/courses';
import { Plus, BookOpen, Layers } from 'lucide-react';
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
    <div>
      {/* ── Page hero header ────────────────────────────────── */}
      <div className="relative -mx-6 -mt-6 mb-8 overflow-hidden border-b border-border bg-card">
        {/* Tech grid */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="courses-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#courses-grid)" />
        </svg>

        {/* Glow accents */}
        <div
          className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl"
          style={{ background: 'rgb(253 8 93 / 10%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-10 left-1/3 h-32 w-64 rounded-full blur-3xl"
          style={{ background: 'oklch(0.80 0.13 210 / 0.06)' }}
        />

        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, rgb(253 8 93 / 60%), transparent)' }}
        />

        <div className="relative px-6 py-8">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-primary" style={{ filter: 'drop-shadow(0 0 6px #fd085d)' }} />
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Học tập</p>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Khoá học</h1>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {total > 0 ? (
                    <span>
                      <span className="font-semibold text-foreground">{total}</span> khoá học
                    </span>
                  ) : 'Chưa có khoá học nào'}
                </p>
              </div>
            </div>

            {canCreate && (
              <Link
                href="/courses/new"
                className="shrink-0 flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5"
                style={{ boxShadow: '0 4px 20px rgb(253 8 93 / 35%)' }}
              >
                <Plus className="h-4 w-4" />
                Tạo khoá học
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <div className="mb-6">
        <CourseFilterBar role={role} />
      </div>

      {/* ── Course grid ────────────────────────────────────── */}
      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-24 text-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10"
            style={{ boxShadow: '0 0 24px rgb(253 8 93 / 15%)' }}
          >
            <BookOpen className="h-8 w-8 text-primary/50" />
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

      {/* ── Pagination ─────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {page > 1 && (
            <Link href={buildPageHref(baseParams, page - 1)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              ← Trước
            </Link>
          )}
          <span className="flex items-center rounded-lg border border-border bg-card px-4 text-sm text-muted-foreground font-mono">
            {page} / {totalPages}
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
