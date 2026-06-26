import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail } from '@lumibach/types';
import { AssignmentForm } from '@/components/features/assignments/AssignmentForm';
import { prisma } from '@/lib/db';

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

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  const canManage = course.viewerCanManage;
  if (!canManage) redirect(`/courses/${slug}/assignments`);

  const modules = await prisma.module.findMany({
    where: { courseId: course.id },
    orderBy: { position: 'asc' },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-5xl">
      <AssignmentForm
        mode="create"
        courseSlug={slug}
        courseId={course.id}
        modules={modules}
        defaultModuleId={defaultModuleId}
      />
    </div>
  );
}
