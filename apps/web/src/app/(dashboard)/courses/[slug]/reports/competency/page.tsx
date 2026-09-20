import { cookies } from 'next/headers';
import Link from 'next/link';
import { Target } from 'lucide-react';
import { apiServerClient } from '@/lib/api-client';
import {
  COMPETENCY_LEVELS,
  LEARNING_PACE_LEVELS,
  type CourseDetail,
  type CompetencyStats,
  type CompetencyLevelValue,
  type CompetencyPeriod,
  type CompetencyPeriodGrid,
} from '@lumibach/types';
import { AllStudentsExportButton } from '@/components/features/portfolio/AllStudentsExportButton';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Phân tích năng lực - Khóa học' };
export const dynamic = 'force-dynamic';

function scoreLabel(avg: number | null) {
  if (avg === null) return '—';
  const idx = Math.min(4, Math.max(0, Math.round(avg)));
  return `${avg.toFixed(1)} · ${COMPETENCY_LEVELS[idx]!.short}`;
}

export default async function CompetencyReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { slug } = await params;
  const { period: periodParam } = await searchParams;
  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`);

  const stats = await api.get<CompetencyStats>(`/courses/${course.id}/competencies/stats`).catch(
    () =>
      ({
        totalIndicators: 0,
        totalStudents: 0,
        totalAssessments: 0,
        indicators: [],
        students: [],
        categories: [],
        evidenceTypes: [],
      }) as CompetencyStats
  );

  const periods = await api
    .get<CompetencyPeriod[]>(`/courses/${course.id}/competencies/periods`)
    .catch(() => [] as CompetencyPeriod[]);
  const selectedPeriodId = periodParam ?? periods[0]?.id ?? null;
  const periodGrid = selectedPeriodId
    ? await api
        .get<CompetencyPeriodGrid>(
          `/courses/${course.id}/competencies/periods/${selectedPeriodId}/grid`
        )
        .catch(() => null)
    : null;

  if (stats.totalIndicators === 0) {
    return (
      <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-14 text-center">
        <div className="bg-primary/10 text-primary mb-3 flex h-12 w-12 items-center justify-center rounded-lg">
          <Target className="h-6 w-6" />
        </div>
        <p className="font-medium">Khoá học chưa có chỉ báo năng lực.</p>
        <p className="text-muted-foreground mt-1 max-w-md text-sm">
          Hãy tạo danh mục &amp; chỉ báo trong mục{' '}
          <Link href={`/courses/${slug}/competencies`} className="text-primary underline">
            Năng lực
          </Link>
          , gán cho hoạt động và chấm cho học sinh để xem phân tích tại đây.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-3xl text-sm">
          Tổng hợp năng lực toàn khoá. Có thể xuất file XLSX bảng dữ liệu của toàn bộ HS (gồm bài
          làm, minh chứng năng lực, tự đánh giá) để phân tích thêm.
        </p>
        <AllStudentsExportButton courseId={course.id} courseName={course.name} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Chỉ báo" value={String(stats.totalIndicators)} />
        <SummaryCard label="Học viên" value={String(stats.totalStudents)} />
        <SummaryCard label="Lượt đánh giá" value={String(stats.totalAssessments)} />
        <SummaryCard
          label="Danh mục"
          value={String(stats.categories.length)}
          tone="text-cyan-700 dark:text-cyan-400"
        />
      </div>

      <LevelLegend />

      {/* Điểm năng lực theo kỳ đánh giá */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold sm:text-xl">Điểm năng lực theo kỳ</h2>
          {periods.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {periods.map((p) => (
                <Link
                  key={p.id}
                  href={`/courses/${slug}/reports/competency?period=${p.id}`}
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                    p.id === selectedPeriodId
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border bg-card hover:bg-muted/40'
                  )}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {!periodGrid ? (
          <div className="border-border bg-card text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm">
            Khoá học chưa có kỳ đánh giá năng lực. Vào{' '}
            <Link href={`/courses/${slug}/competencies/levels`} className="text-primary underline">
              Cấp độ năng lực
            </Link>{' '}
            để tạo kỳ và nhập cấp độ xuất phát/đích cho học sinh.
          </div>
        ) : (
          <div className="border-border bg-card overflow-x-auto rounded-xl border shadow-sm">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-border bg-muted/50 border-b text-left text-xs">
                <tr>
                  <Th>Học sinh</Th>
                  <Th>Danh mục</Th>
                  <Th align="right">Xuất phát</Th>
                  <Th align="right">Đích</Th>
                  <Th align="right">Hoàn thành</Th>
                  <Th align="right">Tỉ lệ %</Th>
                  <Th align="right">Điểm năng lực</Th>
                  <Th align="right">Tăng trưởng</Th>
                  <Th>Tiến độ</Th>
                </tr>
              </thead>
              <tbody>
                {periodGrid.categoryRollups.map((row) => {
                  const pace = row.learningPace
                    ? LEARNING_PACE_LEVELS.find((l) => l.value === row.learningPace)
                    : null;
                  return (
                    <tr
                      key={`${row.studentId}::${row.categoryId}`}
                      className="border-border hover:bg-muted/40 border-b last:border-0"
                    >
                      <Td>{row.studentName}</Td>
                      <Td>
                        <span className="text-muted-foreground text-xs">{row.categoryName}</span>
                      </Td>
                      <Td align="right">
                        {row.startLevel !== null ? row.startLevel.toFixed(2) : '—'}
                      </Td>
                      <Td align="right">
                        {row.targetLevel !== null ? row.targetLevel.toFixed(2) : '—'}
                      </Td>
                      <Td align="right">
                        {row.completedIndicators}/{row.totalIndicators}
                      </Td>
                      <Td align="right">
                        {row.completionRate !== null
                          ? `${Math.round(row.completionRate * 100)}%`
                          : '—'}
                      </Td>
                      <Td align="right">
                        {row.competencyScore !== null ? row.competencyScore.toFixed(2) : '—'}
                      </Td>
                      <Td align="right">
                        {row.growthScore !== null ? row.growthScore.toFixed(2) : '—'}
                      </Td>
                      <Td>
                        {pace ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
                            style={{ backgroundColor: pace.color, color: pace.textColor }}
                          >
                            {pace.label}
                          </span>
                        ) : (
                          '—'
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Trung bình theo danh mục */}
      {stats.categories.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold sm:text-xl">Trung bình theo danh mục</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.categories.map((c) => (
              <div
                key={c.categoryId}
                className="border-border bg-card rounded-xl border px-4 py-4 shadow-sm"
              >
                <p className="truncate text-sm font-medium" title={c.categoryName}>
                  {c.categoryName}
                </p>
                <p className="text-primary mt-1 text-xl font-bold">{scoreLabel(c.averageScore)}</p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {c.totalAssessments} lượt đánh giá
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Phân bố mức độ theo chỉ báo */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold sm:text-xl">Phân bố mức độ theo chỉ báo</h2>
        <div className="border-border bg-card overflow-x-auto rounded-xl border shadow-sm">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-border bg-muted/50 border-b text-left text-xs">
              <tr>
                <Th>Chỉ báo</Th>
                <Th>Danh mục</Th>
                <Th>Phân bố mức độ</Th>
                <Th align="right">Đạt</Th>
                <Th align="right">TB</Th>
              </tr>
            </thead>
            <tbody>
              {stats.indicators.map((ind) => (
                <tr
                  key={ind.indicatorId}
                  className="border-border hover:bg-muted/40 border-b last:border-0"
                >
                  <Td>
                    <p className="font-medium">
                      {ind.indicatorCode && (
                        <span className="text-muted-foreground mr-1.5 font-mono text-xs">
                          {ind.indicatorCode}
                        </span>
                      )}
                      {ind.indicatorName}
                    </p>
                  </Td>
                  <Td>
                    <span className="text-muted-foreground text-xs">{ind.categoryName}</span>
                  </Td>
                  <Td>
                    <DistributionBar counts={ind.levelCounts} total={ind.totalAssessments} />
                  </Td>
                  <Td align="right">
                    {ind.studentsAssessedCount > 0
                      ? `${ind.studentsCompletedCount}/${ind.studentsAssessedCount}`
                      : '—'}
                  </Td>
                  <Td align="right">{scoreLabel(ind.averageScore)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Học viên theo năng lực */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold sm:text-xl">Năng lực theo học viên</h2>
        <div className="border-border bg-card overflow-x-auto rounded-xl border shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-border bg-muted/50 border-b text-left text-xs">
              <tr>
                <Th>Học viên</Th>
                <Th>Email</Th>
                <Th>Phân bố mức độ</Th>
                <Th align="right">Đạt</Th>
                <Th align="right">TB</Th>
              </tr>
            </thead>
            <tbody>
              {stats.students.map((s) => (
                <tr
                  key={s.studentId}
                  className="border-border hover:bg-muted/40 border-b last:border-0"
                >
                  <Td>
                    <Link
                      href={`/courses/${slug}/portfolio/${s.studentId}`}
                      className="hover:text-primary font-medium underline-offset-4 hover:underline"
                    >
                      {s.studentName}
                    </Link>
                  </Td>
                  <Td>
                    <span className="text-muted-foreground text-xs">{s.email}</span>
                  </Td>
                  <Td>
                    <DistributionBar counts={s.levelCounts} total={s.totalAssessments} />
                  </Td>
                  <Td align="right">
                    {s.indicatorsAssessedCount > 0
                      ? `${s.indicatorsCompletedCount}/${s.indicatorsAssessedCount}`
                      : '—'}
                  </Td>
                  <Td align="right">{scoreLabel(s.averageScore)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Loại minh chứng */}
      {stats.evidenceTypes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold sm:text-xl">Loại minh chứng đã ghi nhận</h2>
          <div className="border-border bg-card space-y-3 rounded-xl border p-4 shadow-sm">
            {stats.evidenceTypes.map((e) => {
              const max = stats.evidenceTypes[0]?.count ?? 1;
              const pct = max > 0 ? Math.round((e.count / max) * 100) : 0;
              return (
                <div key={e.evidenceType} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm sm:w-64" title={e.label}>
                    {e.label}
                  </span>
                  <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-muted-foreground w-8 shrink-0 text-right text-sm tabular-nums">
                    {e.count}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function LevelLegend() {
  return (
    <div className="flex flex-wrap gap-3">
      {COMPETENCY_LEVELS.map((l) => (
        <div key={l.value} className="flex items-center gap-1.5 text-sm">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: l.color }} />
          <span className="text-muted-foreground">{l.label}</span>
        </div>
      ))}
    </div>
  );
}

function DistributionBar({
  counts,
  total,
}: {
  counts: Record<CompetencyLevelValue, number>;
  total: number;
}) {
  if (total === 0) {
    return <span className="text-muted-foreground text-xs">Chưa chấm</span>;
  }
  return (
    <div className="flex h-4 w-full min-w-40 overflow-hidden rounded-sm">
      {COMPETENCY_LEVELS.map((l) => {
        const count = counts[l.value] ?? 0;
        if (count === 0) return null;
        const pct = (count / total) * 100;
        return (
          <div
            key={l.value}
            style={{ width: `${pct}%`, backgroundColor: l.color }}
            title={`${l.label}: ${count}`}
          />
        );
      })}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'text-primary',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="border-border bg-card rounded-xl border px-4 py-4 shadow-sm">
      <p className="text-muted-foreground text-sm font-medium">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`text-muted-foreground px-4 py-3 text-xs font-semibold whitespace-nowrap ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td className={`px-4 py-3 align-top ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </td>
  );
}
