import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { AssignmentForm } from '@/components/features/assignments/AssignmentForm';
import { prisma } from '@/lib/db';
import type { UserRole } from '@prisma/client';

export const metadata = { title: 'Tạo bài tập mới' };

export default async function NewAssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ moduleId?: string }>;
}) {
  const { slug } = await params;
  const { moduleId: defaultModuleId } = await searchParams;
  const session = await auth();
  const role = session?.user?.role as UserRole;

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const canManage = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session?.user?.id);
  if (!canManage) redirect(`/courses/${slug}/assignments`);

  const modules = await prisma.module.findMany({
    where: { courseId: course.id },
    orderBy: { position: 'asc' },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-5xl">
      <AssignmentForm mode="create" courseSlug={slug} courseId={course.id} modules={modules} defaultModuleId={defaultModuleId} />
    </div>
  );
}
