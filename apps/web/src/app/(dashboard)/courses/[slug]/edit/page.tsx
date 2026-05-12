import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { CourseForm } from '@/components/features/courses/CourseForm';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Chỉnh sửa khoá học' };

export default async function EditCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole;

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const canEdit = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session?.user?.id);

  if (!canEdit) redirect(`/courses/${slug}`);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Chỉnh sửa khoá học</h1>
        <p className="text-muted-foreground text-sm">{course.name}</p>
      </div>
      <CourseForm mode="edit" course={course} />
    </div>
  );
}
