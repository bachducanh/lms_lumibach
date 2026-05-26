import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { PracticeTestForm } from '@/components/features/practice-tests/PracticeTestForm';
import type { CourseDetail, PracticeTestDetail } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Chỉnh sửa đề luyện tập' };

export default async function EditPracticeTestPage({
  params,
}: {
  params: Promise<{ slug: string; practiceTestId: string }>;
}) {
  const { slug, practiceTestId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  const api = apiServerClient(await cookies());
  const [course, practiceTest] = await Promise.all([
    api.get<CourseDetail>(`/courses/${slug}`).catch(() => null),
    api.get<PracticeTestDetail>(`/practice-tests/${practiceTestId}`).catch(() => null),
  ]);
  if (!course || !practiceTest) notFound();

  const canManage =
    role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session?.user?.id);
  if (!canManage) redirect(`/courses/${slug}/practice-tests/${practiceTestId}`);

  return (
    <PracticeTestForm
      mode="edit"
      courseId={course.id}
      courseSlug={slug}
      practiceTest={practiceTest}
      moduleId={practiceTest.moduleItems?.[0]?.moduleId}
    />
  );
}
