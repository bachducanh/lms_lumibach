import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail } from '@lumibach/types';
import { ReportsNav } from '@/components/features/reports/ReportsNav';

export default async function ReportsLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) redirect(`/courses/${slug}`);

  if (!course.viewerCanGrade) redirect(`/courses/${slug}`);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Báo cáo khóa học
        </h1>
        <p className="text-muted-foreground mt-1 text-sm break-words">{course.name}</p>
      </div>

      <ReportsNav slug={slug} />

      <div>{children}</div>
    </div>
  );
}
