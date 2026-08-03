import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { hasMinRole } from '@/lib/permissions';
import { ArrowLeft, GaugeCircle } from 'lucide-react';
import { CompetencyLevelGrid } from '@/components/features/competencies/CompetencyLevelGrid';
import type { CourseDetail, CompetencyPeriod, CompetencyPeriodGrid } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Cấp độ năng lực' };
export const dynamic = 'force-dynamic';

export default async function CompetencyLevelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { slug } = await params;
  const { period: periodParam } = await searchParams;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();
  if (!role || !hasMinRole(role, 'TA')) redirect('/courses');

  const periods = await api
    .get<CompetencyPeriod[]>(`/courses/${course.id}/competencies/periods`)
    .catch(() => [] as CompetencyPeriod[]);

  const selectedPeriodId = periodParam ?? periods[0]?.id ?? null;

  const grid = selectedPeriodId
    ? await api
        .get<CompetencyPeriodGrid>(
          `/courses/${course.id}/competencies/periods/${selectedPeriodId}/grid`
        )
        .catch(() => null)
    : null;

  return (
    <div className="max-w-6xl space-y-6">
      <Link
        href={`/courses/${slug}/competencies`}
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-xs transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Năng lực
      </Link>

      <div className="flex items-start gap-3">
        <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <GaugeCircle className="text-primary h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Cấp độ năng lực</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Nhập cấp độ xuất phát/đích cho từng học sinh theo kỳ đánh giá — điểm năng lực, mức tăng
            trưởng và tiến độ học tập được tính tự động theo Chính sách đánh giá.
          </p>
        </div>
      </div>

      <CompetencyLevelGrid
        slug={slug}
        courseId={course.id}
        canManage={course.viewerCanGrade}
        periods={periods}
        selectedPeriodId={selectedPeriodId}
        grid={grid}
      />
    </div>
  );
}
