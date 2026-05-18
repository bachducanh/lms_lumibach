import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail } from '@lumibach/types';
import { LiveLogsClient } from '@/components/features/activity/LiveLogsClient';

export const metadata = { title: 'Live logs — Khoá học' };
export const dynamic = 'force-dynamic';

export default async function CourseLiveLogsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`);

  return <LiveLogsClient courseId={course.id} />;
}
