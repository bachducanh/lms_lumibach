import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { LessonEditor } from '@/components/features/courses/LessonEditor';
import { hasMinRole } from '@/lib/permissions';
import type { CourseDetail } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Tạo bài giảng mới' };

export default async function NewLessonPage({
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

  const canManage =
    role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session?.user?.id);
  if (!canManage) redirect(`/courses/${slug}`);

  if (!moduleId) redirect(`/courses/${slug}/modules`);

  return (
    <div className="max-w-5xl">
      <LessonEditor mode="create" courseSlug={slug} courseId={course.id} moduleId={moduleId} />
    </div>
  );
}
