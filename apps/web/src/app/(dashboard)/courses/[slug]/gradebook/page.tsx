import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail, GradebookData } from '@lumibach/types';
import { GradebookTable } from '@/components/features/courses/GradebookTable';
import { hasMinRole } from '@/lib/permissions';
import { ArrowLeft, TableProperties } from 'lucide-react';
import type { UserRole } from '@lumibach/db';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  return { title: `Bảng điểm — ${course?.name ?? ''}` };
}

export default async function GradebookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();
  if (!role || !hasMinRole(role, 'TA')) redirect(`/courses/${slug}`);

  const data = await api.get<GradebookData>('/gradebook', { query: { courseId: course.id } });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Breadcrumb */}
      <Link
        href={`/courses/${slug}`}
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {course.name}
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
          <TableProperties className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Bảng điểm</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{course.name}</p>
        </div>
      </div>

      {data.columns.length === 0 ? (
        <div className="border-border bg-muted/30 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <TableProperties className="text-muted-foreground/50 h-8 w-8" />
          <p className="text-muted-foreground text-sm">Chưa có bài tập hoặc quiz nào được đăng.</p>
        </div>
      ) : (
        <GradebookTable columns={data.columns} students={data.students} courseSlug={slug} />
      )}
    </div>
  );
}
