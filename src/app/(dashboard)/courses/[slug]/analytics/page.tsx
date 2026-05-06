import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseAnalyticsAction } from '@/actions/analytics';
import { hasMinRole } from '@/lib/permissions';
import {
  LineChart, BarChart, HorizontalBars,
} from '@/components/features/analytics/MiniCharts';
import { StatCard } from '@/components/features/analytics/StatCard';
import {
  BarChart3, Users, FileText, Brain, Code2, Activity, TrendingUp,
  ChevronLeft, AlertTriangle, ChevronRight,
} from 'lucide-react';
import type { UserRole } from '@prisma/client';

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

  const data = await getCourseAnalyticsAction(slug);
  if (!data) notFound();

  const fmt = (n: number | null, suffix = '') =>
    n === null ? '—' : `${Math.round(n)}${suffix}`;

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div>
        <Link
          href={`/courses/${slug}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mb-2"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {data.course.name}
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
            <BarChart3 className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Phân tích khoá học</h1>
            <p className="text-sm text-muted-foreground">{data.course.name}</p>
          </div>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Học viên" value={data.totals.enrolled} accent="rose" icon={Users}
          hint={`${data.totals.activeStudents7} hoạt động 7 ngày`} />
        <StatCard label="Lượt làm quiz" value={data.totals.quizAttempts} accent="amber" icon={Brain} />
        <StatCard label="Bài tập đã nộp" value={data.totals.assignmentSubmits} accent="emerald" icon={FileText} />
        <StatCard label="Code đã nộp" value={data.totals.codeSubmits} accent="cyan" icon={Code2} />
        <StatCard label="Trung bình quiz" value={fmt(data.totals.avgQuizPercent, '%')} accent="violet" icon={TrendingUp} />
        <StatCard label="Code pass rate" value={fmt(data.totals.codePassRate, '%')} accent="emerald" icon={TrendingUp} />
      </div>

      {/* Activity timeline */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            Hoạt động 30 ngày
          </h2>
          <span className="text-xs text-muted-foreground">
            {data.dailyActivity30.reduce((a, b) => a + b.value, 0)} sự kiện
          </span>
        </div>
        <LineChart data={data.dailyActivity30} height={140} showAxis color="oklch(0.7 0.18 220)" />
      </div>

      {/* Quiz score distribution + top students */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
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
            <p className="text-xs text-muted-foreground py-6 text-center">Chưa có quiz nào được nộp.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            Học sinh năng động nhất
          </h2>
          {data.topStudents.length > 0 ? (
            <HorizontalBars
              items={data.topStudents.slice(0, 8).map((s) => ({
                label: s.name,
                value: s.activity,
                sublabel: s.avgQuiz !== null
                  ? `${s.activity} sự kiện · TB quiz ${Math.round(s.avgQuiz)}%`
                  : `${s.activity} sự kiện`,
              }))}
              color="oklch(0.7 0.18 140)"
            />
          ) : (
            <p className="text-xs text-muted-foreground">Chưa có dữ liệu.</p>
          )}
        </div>
      </div>

      {/* Inactive students */}
      {data.inactiveStudents.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Học sinh không hoạt động trong 7 ngày
            </h2>
            <span className="text-xs text-muted-foreground">{data.inactiveStudents.length} học sinh</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.inactiveStudents.map((s) => (
              <div key={s.id} className="rounded-lg border border-border/60 bg-card px-3 py-2 text-xs">
                <p className="font-medium truncate">{s.name}</p>
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
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4 text-amber-400" />
            Chi tiết theo Quiz
          </h2>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-2 py-2 font-medium">Quiz</th>
                  <th className="text-right px-2 py-2 font-medium">Lượt thử</th>
                  <th className="text-right px-2 py-2 font-medium">Hoàn thành</th>
                  <th className="text-right px-2 py-2 font-medium">TB điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.perQuiz.map((q) => (
                  <tr key={q.id}>
                    <td className="px-2 py-2 truncate max-w-xs">
                      <Link
                        href={`/courses/${slug}/quizzes/${q.id}`}
                        className="hover:text-primary transition-colors inline-flex items-center gap-1"
                      >
                        {q.title}
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{q.attempts}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      <span className="inline-block w-20 h-1.5 rounded-full bg-muted overflow-hidden align-middle mr-2">
                        <span className="block h-full bg-primary" style={{ width: `${Math.min(100, q.completionRate)}%` }} />
                      </span>
                      {Math.round(q.completionRate)}%
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium">
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
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-400" />
            Chi tiết theo Bài tập
          </h2>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-2 py-2 font-medium">Bài tập</th>
                  <th className="text-right px-2 py-2 font-medium">Tỉ lệ nộp</th>
                  <th className="text-right px-2 py-2 font-medium">TB điểm</th>
                  <th className="text-right px-2 py-2 font-medium">Nộp muộn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.perAssignment.map((a) => (
                  <tr key={a.id}>
                    <td className="px-2 py-2 truncate max-w-xs">
                      <Link
                        href={`/courses/${slug}/assignments/${a.id}`}
                        className="hover:text-primary transition-colors inline-flex items-center gap-1"
                      >
                        {a.title}
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      <span className="inline-block w-20 h-1.5 rounded-full bg-muted overflow-hidden align-middle mr-2">
                        <span className="block h-full bg-emerald-500" style={{ width: `${Math.min(100, a.submissionRate)}%` }} />
                      </span>
                      {Math.round(a.submissionRate)}%
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium">
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
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Code2 className="h-4 w-4 text-violet-400" />
            Chi tiết theo Bài tập code
          </h2>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-2 py-2 font-medium">Bài tập</th>
                  <th className="text-right px-2 py-2 font-medium">Học sinh thử</th>
                  <th className="text-right px-2 py-2 font-medium">Tỉ lệ pass</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.perExercise.map((e) => (
                  <tr key={e.id}>
                    <td className="px-2 py-2 truncate max-w-xs">
                      <Link
                        href={`/courses/${slug}/exercises/${e.id}`}
                        className="hover:text-primary transition-colors inline-flex items-center gap-1"
                      >
                        {e.title}
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{e.studentsAttempted}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      <span className="inline-block w-20 h-1.5 rounded-full bg-muted overflow-hidden align-middle mr-2">
                        <span className="block h-full bg-violet-500" style={{ width: `${Math.min(100, e.passRate)}%` }} />
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
