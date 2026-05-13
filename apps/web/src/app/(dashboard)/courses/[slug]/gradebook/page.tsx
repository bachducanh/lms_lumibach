import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail } from '@lumibach/types';
import { getGradebookAction } from '@/actions/gradebook';
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

  const data = await getGradebookAction(course.id);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href={`/courses/${slug}`}
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-xs transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {course.name}
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
          <TableProperties className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Bảng điểm</h1>
          <p className="text-muted-foreground mt-0.5 text-xs">{course.name}</p>
        </div>
      </div>

      {data.columns.length === 0 ? (
        <div className="border-border bg-muted/30 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed py-16 text-center">
          <TableProperties className="text-muted-foreground/30 h-8 w-8" />
          <p className="text-muted-foreground text-sm">Chưa có bài tập hoặc quiz nào được đăng.</p>
        </div>
      ) : (
        <GradebookTable columns={data.columns} students={data.students} />
      )}
    </div>
  );
}
