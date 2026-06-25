import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiServerClient, ApiError } from '@/lib/api-client';
import type { CourseAnalytics } from '@lumibach/types';
import { hasMinRole } from '@/lib/permissions';
import { LineChart, BarChart, HorizontalBars } from '@/components/features/analytics/MiniCharts';
import { StatCard } from '@/components/features/analytics/StatCard';
import {
  BarChart3,
  Users,
  FileText,
  Brain,
  Code2,
  Activity,
  TrendingUp,
  ChevronLeft,
  AlertTriangle,
  ChevronRight,
  Database,
} from 'lucide-react';
import type { UserRole } from '@lumibach/db';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Phân tích · ${slug}` };
}

export default async function CourseAnalyticsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) redirect(`/courses/${slug}`);

  const api = apiServerClient(await cookies());
  const data = await api.get<CourseAnalytics>(`/analytics/course/${slug}`).catch((err: unknown) => {
    if (err instanceof ApiError) return null;
    throw err;
  });
  if (!data) notFound();

  const fmt = (n: number | null, suffix = '') => (n === null ? '—' : `${Math.round(n)}${suffix}`);

  return (
    <div className="max-w-[1400px] space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/courses/${slug}`}
          className="text-muted-foreground hover:text-primary mb-2 inline-flex items-center gap-1.5 text-xs transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {data.course.name}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
              <BarChart3 className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Phân tích khoá học</h1>
              <p className="text-muted-foreground text-sm">{data.course.name}</p>
            </div>
          </div>
          <Link
            href={`/courses/${slug}/analytics/clustering`}
            className="border-input bg-background hover:bg-accent inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors"
          >
            <Database className="h-4 w-4" />
            Dữ liệu phân cụm
          </Link>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Học viên"
          value={data.totals.enrolled}
          accent="rose"
          icon={Users}
          hint={`${data.totals.activeStudents7} hoạt động 7 ngày`}
        />
        <StatCard
          label="Lượt làm quiz"
          value={data.totals.quizAttempts}
          accent="amber"
          icon={Brain}
        />
        <StatCard
          label="Bài tập đã nộp"
          value={data.totals.assignmentSubmits}
          accent="emerald"
          icon={FileText}
        />
        <StatCard label="Code đã nộp" value={data.totals.codeSubmits} accent="cyan" icon={Code2} />
        <StatCard
          label="Trung bình quiz"
          value={fmt(data.totals.avgQuizPercent, '%')}
          accent="violet"
          icon={TrendingUp}
        />
        <StatCard
          label="Code pass rate"
          value={fmt(data.totals.codePassRate, '%')}
          accent="emerald"
          icon={TrendingUp}
        />
      </div>

      {/* Activity timeline */}
      <div className="border-border bg-card space-y-3 rounded-xl border p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-cyan-400" />
            Hoạt động 30 ngày
          </h2>
          <span className="text-muted-foreground text-xs">
            {data.dailyActivity30.reduce((a, b) => a + b.value, 0)} sự kiện
          </span>
        </div>
        <LineChart data={data.dailyActivity30} height={140} showAxis color="oklch(0.7 0.18 220)" />
      </div>

      {/* Quiz score distribution + top students */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="border-border bg-card space-y-3 rounded-xl border p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Brain className="h-4 w-4 text-amber-400" />
            Phân bổ điểm quiz (%)
          </h2>
          {data.quizScoreDist.some((d) => d.count > 0) ? (
            <BarChart
              data={data.quizScoreDist.map((d) => ({ label: d.bucket, value: d.count }))}
              height={180}
              color="oklch(0.78 0.16 75)"
            />
          ) : (
            <p className="text-muted-foreground py-6 text-center text-xs">
              Chưa có quiz nào được nộp.
            </p>
          )}
        </div>

        <div className="border-border bg-card space-y-3 rounded-xl border p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            Học sinh năng động nhất
          </h2>
          {data.topStudents.length > 0 ? (
            <HorizontalBars
              items={data.topStudents.slice(0, 8).map((s) => ({
                label: s.name,
                value: s.activity,
                sublabel:
                  s.avgQuiz !== null
                    ? `${s.activity} sự kiện · TB quiz ${Math.round(s.avgQuiz)}%`
                    : `${s.activity} sự kiện`,
              }))}
              color="oklch(0.7 0.18 140)"
            />
          ) : (
            <p className="text-muted-foreground text-xs">Chưa có dữ liệu.</p>
          )}
        </div>
      </div>

      {/* Inactive students */}
      {data.inactiveStudents.length > 0 && (
        <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Học sinh không hoạt động trong 7 ngày
            </h2>
            <span className="text-muted-foreground text-xs">
              {data.inactiveStudents.length} học sinh
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.inactiveStudents.map((s) => (
              <div
                key={s.id}
                className="border-border/60 bg-card rounded-lg border px-3 py-2 text-xs"
              >
                <p className="truncate font-medium">{s.name}</p>
                <p className="text-muted-foreground">
                  {s.lastSeenAt
                    ? `Lần cuối: ${new Date(s.lastSeenAt).toLocaleDateString('vi-VN')}`
                    : 'Chưa từng truy cập'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-quiz */}
      {data.perQuiz.length > 0 && (
        <div className="border-border bg-card space-y-3 rounded-xl border p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Brain className="h-4 w-4 text-amber-400" />
            Chi tiết theo Quiz
          </h2>
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs">
                  <th className="px-2 py-2 text-left font-medium">Quiz</th>
                  <th className="px-2 py-2 text-right font-medium">Lượt thử</th>
                  <th className="px-2 py-2 text-right font-medium">Hoàn thành</th>
                  <th className="px-2 py-2 text-right font-medium">TB điểm</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.perQuiz.map((q) => (
                  <tr key={q.id}>
                    <td className="max-w-xs truncate px-2 py-2">
                      <Link
                        href={`/courses/${slug}/quizzes/${q.id}`}
                        className="hover:text-primary inline-flex items-center gap-1 transition-colors"
                      >
                        {q.title}
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{q.attempts}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      <span className="bg-muted mr-2 inline-block h-1.5 w-20 overflow-hidden rounded-full align-middle">
                        <span
                          className="bg-primary block h-full"
                          style={{ width: `${Math.min(100, q.completionRate)}%` }}
                        />
                      </span>
                      {Math.round(q.completionRate)}%
                    </td>
                    <td className="px-2 py-2 text-right font-medium tabular-nums">
                      {q.avgPercent !== null ? `${Math.round(q.avgPercent)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-assignment */}
      {data.perAssignment.length > 0 && (
        <div className="border-border bg-card space-y-3 rounded-xl border p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-emerald-400" />
            Chi tiết theo Bài tập
          </h2>
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs">
                  <th className="px-2 py-2 text-left font-medium">Bài tập</th>
                  <th className="px-2 py-2 text-right font-medium">Tỉ lệ nộp</th>
                  <th className="px-2 py-2 text-right font-medium">TB điểm</th>
                  <th className="px-2 py-2 text-right font-medium">Nộp muộn</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.perAssignment.map((a) => (
                  <tr key={a.id}>
                    <td className="max-w-xs truncate px-2 py-2">
                      <Link
                        href={`/courses/${slug}/assignments/${a.id}`}
                        className="hover:text-primary inline-flex items-center gap-1 transition-colors"
                      >
                        {a.title}
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      <span className="bg-muted mr-2 inline-block h-1.5 w-20 overflow-hidden rounded-full align-middle">
                        <span
                          className="block h-full bg-emerald-500"
                          style={{ width: `${Math.min(100, a.submissionRate)}%` }}
                        />
                      </span>
                      {Math.round(a.submissionRate)}%
                    </td>
                    <td className="px-2 py-2 text-right font-medium tabular-nums">
                      {a.avgScore !== null ? a.avgScore.toFixed(1) : '—'}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {a.lateCount > 0 ? (
                        <span className="text-amber-500">{a.lateCount}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-exercise */}
      {data.perExercise.length > 0 && (
        <div className="border-border bg-card space-y-3 rounded-xl border p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Code2 className="h-4 w-4 text-violet-400" />
            Chi tiết theo Bài tập code
          </h2>
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs">
                  <th className="px-2 py-2 text-left font-medium">Bài tập</th>
                  <th className="px-2 py-2 text-right font-medium">Học sinh thử</th>
                  <th className="px-2 py-2 text-right font-medium">Tỉ lệ pass</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.perExercise.map((e) => (
                  <tr key={e.id}>
                    <td className="max-w-xs truncate px-2 py-2">
                      <Link
                        href={`/courses/${slug}/exercises/${e.id}`}
                        className="hover:text-primary inline-flex items-center gap-1 transition-colors"
                      >
                        {e.title}
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{e.studentsAttempted}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      <span className="bg-muted mr-2 inline-block h-1.5 w-20 overflow-hidden rounded-full align-middle">
                        <span
                          className="block h-full bg-violet-500"
                          style={{ width: `${Math.min(100, e.passRate)}%` }}
                        />
                      </span>
                      {Math.round(e.passRate)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
