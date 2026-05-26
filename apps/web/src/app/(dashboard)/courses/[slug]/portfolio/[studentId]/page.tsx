import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { ReflectionsPanel } from '@/components/features/portfolio/ReflectionsPanel';
import { CompetencyMatrix } from '@/components/features/portfolio/CompetencyMatrix';
import { PortfolioExportButton } from '@/components/features/portfolio/PortfolioExportButton';
import {
  COMPETENCY_LEVELS,
  EVIDENCE_TYPE_LABEL,
  type CourseDetail,
  type PortfolioData,
  type CompetencyLevelValue,
} from '@lumibach/types';
import {
  ArrowLeft,
  FolderKanban,
  BookOpen,
  GraduationCap,
  Sparkles,
  NotebookPen,
} from 'lucide-react';

export const metadata = { title: 'Hồ sơ học tập' };
export const dynamic = 'force-dynamic';

const ACTIVITY_LABEL: Record<string, string> = {
  assignment: 'Bài tập',
  'code-exercise': 'Bài code',
  quiz: 'Quiz',
  'practice-test': 'Đề luyện tập',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã nộp',
  LATE: 'Nộp trễ',
  GRADED: 'Đã chấm',
  RETURNED: 'Đã trả',
  IN_PROGRESS: 'Đang làm',
  ACCEPTED: 'Đạt',
  PARTIAL: 'Một phần',
  WRONG_ANSWER: 'Sai',
};

function levelMeta(level: CompetencyLevelValue) {
  return COMPETENCY_LEVELS.find((l) => l.value === level) ?? COMPETENCY_LEVELS[0];
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(d));
}

function pct(score: number | null, max: number | null) {
  if (score === null || max === null || max <= 0) return null;
  return Math.round((score / max) * 100);
}

export default async function StudentPortfolioPage({
  params,
}: {
  params: Promise<{ slug: string; studentId: string }>;
}) {
  const { slug, studentId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  const portfolio = await api
    .get<PortfolioData>(`/courses/${course.id}/portfolio/${studentId}`)
    .catch(() => null);
  if (!portfolio) notFound();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-2">
      <Link
        href={`/courses/${slug}`}
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-xs transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {course.name}
      </Link>

      {/* Hero header */}
      <div
        className="border-border bg-card relative overflow-hidden rounded-2xl border p-6 shadow-sm"
        style={{
          background:
            'linear-gradient(135deg, oklch(0.96 0.04 280 / 50%), oklch(0.94 0.05 200 / 40%))',
        }}
      >
        <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <div className="bg-primary/15 border-primary/20 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border shadow-sm">
              <FolderKanban className="text-primary h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-[11px] font-bold tracking-widest uppercase">
                  Hồ sơ học tập
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {portfolio.canEdit ? 'Của bạn' : 'Giáo viên xem'}
                </Badge>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                {portfolio.student.name}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {portfolio.student.email} · {course.name}
              </p>
            </div>
          </div>
          {!portfolio.canEdit && (
            <PortfolioExportButton
              courseId={course.id}
              courseName={course.name}
              portfolio={portfolio}
            />
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="Bài làm"
          value={String(portfolio.summary.totalGraded)}
          icon={<BookOpen className="h-4 w-4" />}
        />
        <SummaryCard
          label="Điểm TB"
          value={
            portfolio.summary.averagePercent === null
              ? '—'
              : `${Math.round(portfolio.summary.averagePercent)}%`
          }
          tone="text-emerald-500"
          icon={<GraduationCap className="h-4 w-4" />}
        />
        <SummaryCard
          label="Minh chứng NL"
          value={String(portfolio.summary.competencyCount)}
          tone="text-cyan-500"
          icon={<Sparkles className="h-4 w-4" />}
        />
        <SummaryCard
          label="Tự đánh giá"
          value={String(portfolio.summary.reflectionCount)}
          tone="text-violet-500"
          icon={<NotebookPen className="h-4 w-4" />}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-4 w-4 text-cyan-500" /> Ma trận năng lực theo chương
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              U1, U2, U3… tương ứng Chương 1, Chương 2, Chương 3… trong nội dung khoá học. Bấm "Xem
              minh chứng" trên một ô để xem các đánh giá cụ thể.
            </p>
          </div>
        </div>
        <CompetencyMatrix matrix={portfolio.matrix} evidence={portfolio.competencyEvidence} />
      </section>

      {/* Graded work */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Bài làm &amp; điểm</h2>
        {portfolio.gradedItems.length === 0 ? (
          <p className="text-muted-foreground text-sm">Chưa có bài làm nào được ghi nhận.</p>
        ) : (
          <div className="border-border bg-card overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="border-border bg-muted/30 border-b text-left text-xs">
                <tr>
                  <Th>Hoạt động</Th>
                  <Th>Loại</Th>
                  <Th align="right">Điểm</Th>
                  <Th>Trạng thái</Th>
                  <Th align="right">Ngày</Th>
                </tr>
              </thead>
              <tbody>
                {portfolio.gradedItems.map((g) => {
                  const p = pct(g.score, g.maxScore);
                  return (
                    <tr key={`${g.activityType}-${g.id}`} className="border-border/50 border-b">
                      <Td>
                        <span className="font-medium">{g.title}</span>
                      </Td>
                      <Td>
                        <Badge variant="outline" className="text-xs">
                          {ACTIVITY_LABEL[g.activityType] ?? g.activityType}
                        </Badge>
                      </Td>
                      <Td align="right">
                        {g.score === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="font-semibold tabular-nums">
                            {g.score}
                            {g.maxScore !== null && (
                              <span className="text-muted-foreground font-normal">
                                /{g.maxScore}
                              </span>
                            )}
                            {p !== null && (
                              <span className="text-muted-foreground ml-1 text-xs">({p}%)</span>
                            )}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span className="text-muted-foreground text-xs">
                          {STATUS_LABEL[g.status] ?? g.status}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="text-muted-foreground text-xs">{fmtDate(g.date)}</span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Competency evidence */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Minh chứng năng lực</h2>
        {portfolio.competencyEvidence.length === 0 ? (
          <p className="text-muted-foreground text-sm">Chưa có đánh giá năng lực.</p>
        ) : (
          <div className="border-border bg-card overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-border bg-muted/30 border-b text-left text-xs">
                <tr>
                  <Th>Chỉ báo</Th>
                  <Th>Danh mục</Th>
                  <Th>Mức độ</Th>
                  <Th>Loại minh chứng</Th>
                  <Th>Hoạt động</Th>
                </tr>
              </thead>
              <tbody>
                {portfolio.competencyEvidence.map((e) => {
                  const lm = levelMeta(e.level);
                  return (
                    <tr key={e.assessmentId} className="border-border/50 border-b">
                      <Td>
                        <span className="font-medium">
                          {e.indicatorCode && (
                            <span className="text-muted-foreground mr-1.5 font-mono text-xs">
                              {e.indicatorCode}
                            </span>
                          )}
                          {e.indicatorName}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-muted-foreground text-xs">{e.categoryName}</span>
                      </Td>
                      <Td>
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: lm!.color }}
                        >
                          {lm!.label}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-muted-foreground text-xs">
                          {e.evidenceType
                            ? (EVIDENCE_TYPE_LABEL[e.evidenceType] ?? e.evidenceType)
                            : '—'}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-muted-foreground text-xs">{e.activityTitle}</span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Self assessment */}
      <ReflectionsPanel
        courseId={course.id}
        reflections={portfolio.reflections}
        canEdit={portfolio.canEdit}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'text-primary',
  icon,
}: {
  label: string;
  value: string;
  tone?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-card hover:border-primary/30 rounded-xl border px-4 py-3.5 shadow-sm transition-colors">
      <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
        {icon && <span className={tone}>{icon}</span>}
        <span>{label}</span>
      </div>
      <p className={`mt-1.5 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`text-muted-foreground px-3 py-2.5 font-semibold whitespace-nowrap ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td className={`px-3 py-2.5 align-top ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </td>
  );
}
