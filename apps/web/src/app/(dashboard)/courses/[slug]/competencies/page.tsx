import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail, CourseCompetencyCatalog } from '@lumibach/types';
import { CompetencyManager } from '@/components/features/competencies/CompetencyManager';
import { hasMinRole } from '@/lib/permissions';
import { ArrowLeft, GaugeCircle, Target } from 'lucide-react';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Năng lực' };
export const dynamic = 'force-dynamic';

export default async function CompetenciesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();
  if (!role || !hasMinRole(role, 'TA')) redirect('/courses');

  const canManage = course.viewerCanManage;

  const catalog = await api
    .get<CourseCompetencyCatalog>(`/courses/${course.id}/competencies`)
    .catch(() => ({ categories: [] }) as CourseCompetencyCatalog);

  const totalIndicators = catalog.categories.reduce(
    (s, c) => s + c.components.reduce((n, comp) => n + comp.indicators.length, 0),
    0
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Link
        href={`/courses/${slug}`}
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {course.name}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <Target className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Năng lực</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {catalog.categories.length} danh mục · {totalIndicators} chỉ báo · {course.name}
            </p>
          </div>
        </div>
        <Link
          href={`/courses/${slug}/competencies/levels`}
          className="border-border bg-card hover:bg-muted inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors"
        >
          <GaugeCircle className="h-4 w-4" />
          Cấp độ năng lực theo kỳ
        </Link>
      </div>

      <div className="border-border bg-card text-muted-foreground rounded-xl border p-4 text-sm leading-relaxed shadow-sm">
        Tạo <span className="text-foreground font-medium">danh mục năng lực</span> và thêm các{' '}
        <span className="text-foreground font-medium">chỉ báo năng lực</span> cho khoá học. Sau đó,
        ở mỗi hoạt động học tập (bài tập, quiz, bài code, đề luyện tập) bạn có thể gán chỉ báo và
        chấm mức độ thành thạo kèm loại minh chứng cho từng học sinh.
      </div>

      <CompetencyManager
        courseId={course.id}
        canManage={canManage}
        categories={catalog.categories}
      />
    </div>
  );
}
