import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { LessonEditor } from '@/components/features/courses/LessonEditor';
import { hasMinRole } from '@/lib/permissions';
import type { CourseDetail, LessonDetail } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Chỉnh sửa bài giảng' };

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;

  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) redirect(`/courses/${slug}`);

  const api = apiServerClient(await cookies());
  const [course, lesson] = await Promise.all([
    api.get<CourseDetail>(`/courses/${slug}`).catch(() => null),
    api.get<LessonDetail>(`/lessons/${lessonId}`).catch(() => null),
  ]);
  if (!course) notFound();

  const canManage =
    role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session?.user?.id);
  if (!canManage) redirect(`/courses/${slug}`);

  if (!lesson) notFound();

  const belongsToCourse = lesson.moduleItems.some((item) => item.module.courseId === course.id);
  if (!belongsToCourse) notFound();

  const moduleId = lesson.moduleItems[0]?.module.id ?? '';

  return (
    <div className="max-w-5xl">
      <LessonEditor
        mode="edit"
        courseSlug={slug}
        courseId={course.id}
        moduleId={moduleId}
        lesson={{
          id: lesson.id,
          title: lesson.title,
          content: lesson.content,
          estimatedMinutes: lesson.estimatedMinutes,
        }}
        attachments={lesson.attachments}
      />
    </div>
  );
}
