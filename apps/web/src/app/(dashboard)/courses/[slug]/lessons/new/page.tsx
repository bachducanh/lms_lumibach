import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { LessonEditor } from '@/components/features/courses/LessonEditor';
import { prisma } from '@/lib/db';
import { hasMinRole } from '@/lib/permissions';
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

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const canManage =
    role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session?.user?.id);
  if (!canManage) redirect(`/courses/${slug}`);

  if (!moduleId) redirect(`/courses/${slug}/modules`);

  const mod = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!mod || mod.courseId !== course.id) notFound();

  return (
    <div className="max-w-5xl">
      <LessonEditor mode="create" courseSlug={slug} courseId={course.id} moduleId={moduleId} />
    </div>
  );
}
