import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail } from '@lumibach/types';
import { ReportsNav } from '@/components/features/reports/ReportsNav';
import { BarChart3 } from 'lucide-react';

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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-xl">
          <BarChart3 className="text-primary h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Báo cáo khóa học</h1>
          <p className="text-muted-foreground truncate text-sm">{course.name}</p>
        </div>
      </div>

      <ReportsNav slug={slug} />

      <div>{children}</div>
    </div>
  );
}
