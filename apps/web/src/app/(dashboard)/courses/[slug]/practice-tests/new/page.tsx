import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import { PracticeTestForm } from '@/components/features/practice-tests/PracticeTestForm';
import type { CourseDetail } from '@lumibach/types';

export const metadata = { title: 'Tạo đề luyện tập' };

export default async function NewPracticeTestPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ moduleId?: string }>;
}) {
  const { slug } = await params;
  const { moduleId } = await searchParams;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  const canManage = course.viewerCanManage;
  if (!canManage) redirect(`/courses/${slug}/modules`);

  return (
    <PracticeTestForm mode="create" courseId={course.id} courseSlug={slug} moduleId={moduleId} />
  );
}
