import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { getLessonAction } from '@/actions/lessons';
import { LessonEditor } from '@/components/features/courses/LessonEditor';
import { hasMinRole } from '@/lib/permissions';
import type { UserRole } from '@prisma/client';

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

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const canManage =
    role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session?.user?.id);
  if (!canManage) redirect(`/courses/${slug}`);

  const lesson = await getLessonAction(lessonId);
  if (!lesson) notFound();

  const belongsToCourse = lesson.moduleItems.some(
    (item) => item.module.courseId === course.id,
  );
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
