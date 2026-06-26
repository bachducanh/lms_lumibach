import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail } from '@lumibach/types';
import { ExerciseEditor } from '@/components/features/code/ExerciseEditor';
import { prisma } from '@/lib/db';
import { hasMinRole } from '@/lib/permissions';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Tạo bài tập code' };

export default async function NewExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ moduleId?: string }>;
}) {
  const { slug } = await params;
  const { moduleId } = await searchParams;

  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) redirect(`/courses/${slug}`);

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  const canManage = course.viewerCanManage;
  if (!canManage) redirect(`/courses/${slug}`);

  if (!moduleId) redirect(`/courses/${slug}/modules`);

  const mod = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!mod || mod.courseId !== course.id) notFound();

  return (
    <div className="max-w-2xl">
      <ExerciseEditor courseId={course.id} courseSlug={slug} moduleId={moduleId} />
    </div>
  );
}
