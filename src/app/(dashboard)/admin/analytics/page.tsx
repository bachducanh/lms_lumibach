import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getAdminOverviewAction } from '@/actions/analytics';
import {
  LineChart, BarChart, HorizontalBars,
} from '@/components/features/analytics/MiniCharts';
import { StatCard } from '@/components/features/analytics/StatCard';
import {
  BarChart3, Users, BookOpen, Code2, FileText, Brain, Activity,
  TrendingUp, ChevronRight,
} from 'lucide-react';
import type { UserRole } from '@prisma/client';

export const metadata = { title: 'Phân tích hệ thống' };

const ROLE_LABEL: Record<string, string> = {
  ADMIN:   'Quản trị',
  TEACHER: 'Giáo viên',
  TA:      'Trợ giảng',
  STUDENT: 'Học sinh',
};

const ACTION_LABEL: Record<string, string> = {
  LOGIN:              'Đăng nhập',
  VIEW_COURSE:        'Xem khoá học',
  VIEW_LESSON:        'Xem bài giảng',
  VIEW_ASSIGNMENT:    'Xem bài tập',
  VIEW_EXERCISE:      'Xem bài code',
  START_QUIZ:         'Bắt đầu quiz',
  SUBMIT_QUIZ:        'Nộp quiz',
  SUBMIT_ASSIGNMENT:  'Nộp bài tập',
  SUBMIT_CODE:        'Nộp code',
};

export default async function AdminAnalyticsPage() {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (role !== 'ADMIN') redirect('/dashboard');

  const data = await getAdminOverviewAction();
  if (!data) redirect('/dashboard');

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
          <BarChart3 className="h-5 w-5 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Phân tích hệ thống</h1>
          <p className="text-sm text-muted-foreground">Tổng quan hoạt động và mức độ tham gia</p>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Người dùng" value={data.totals.users} accent="rose" icon={Users}
          hint={`${data.totals.activeUsers7} hoạt động trong 7 ngày`} />
        <StatCard label="Hoạt động 7 ngày" value={data.totals.activeUsers7} accent="cyan" icon={Activity} />
        <StatCard label="Khoá học" value={data.totals.courses} accent="violet" icon={BookOpen} />
        <StatCard label="Lượt làm quiz" value={data.totals.quizAttempts} accent="amber" icon={Brain} />
        <StatCard label="Bài tập đã nộp" value={data.totals.submissions} accent="emerald" icon={FileText} />
        <StatCard label="Code đã nộp" value={data.totals.codeSubmissions} accent="cyan" icon={Code2} />
      </div>

      {/* Activity over time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-semibold">Hoạt động 30 ngày</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {data.dailyActivity30.reduce((a, b) => a + b.value, 0)} sự kiện
            </span>
          </div>
          <LineChart data={data.dailyActivity30} height={140} showAxis color="oklch(0.7 0.18 220)" />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-semibold">Người dùng hoạt động hàng ngày</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Đỉnh: {Math.max(...data.dailyActiveUsers30.map((d) => d.value))}
            </span>
          </div>
          <LineChart data={data.dailyActiveUsers30} height={140} showAxis color="oklch(0.68 0.21 305)" />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold">Bài nộp hàng ngày (assignment + code)</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {data.dailySubmissions30.reduce((a, b) => a + b.value, 0)} bài
            </span>
          </div>
          <LineChart data={data.dailySubmissions30} height={140} showAxis color="oklch(0.7 0.18 140)" />
        </div>
      </div>

      {/* Bottom row: distributions + lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Action breakdown */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-amber-400" />
            Loại hoạt động (30 ngày)
          </h2>
          {data.actionBreakdown.length > 0 ? (
            <BarChart
              data={data.actionBreakdown.slice(0, 8).map((a) => ({
                label: (ACTION_LABEL[a.action] ?? a.action).slice(0, 8),
                value: a.count,
              }))}
              height={180}
              color="oklch(0.78 0.16 75)"
            />
          ) : (
            <p className="text-xs text-muted-foreground">Chưa có dữ liệu.</p>
          )}
        </div>

        {/* By role */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-rose-400" />
            Phân bổ vai trò
          </h2>
          <HorizontalBars
            items={data.byRole.map((r) => ({
              label: ROLE_LABEL[r.role] ?? r.role,
              value: r.count,
            }))}
          />
        </div>

        {/* Top students */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            Học sinh năng động nhất
          </h2>
          {data.topStudents.length > 0 ? (
            <HorizontalBars
              items={data.topStudents.slice(0, 6).map((s) => ({
                label: s.name,
                value: s.activity,
                sublabel: `${s.activity} sự kiện trong 30 ngày`,
              }))}
              color="oklch(0.7 0.18 140)"
            />
          ) : (
            <p className="text-xs text-muted-foreground">Chưa có dữ liệu.</p>
          )}
        </div>
      </div>

      {/* Top courses */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-violet-400" />
            Khoá học có tương tác cao nhất (30 ngày)
          </h2>
        </div>
        {data.topCourses.length === 0 ? (
          <p className="text-xs text-muted-foreground">Chưa có dữ liệu.</p>
        ) : (
          <div className="space-y-2">
            {data.topCourses.map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.slug}/analytics`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-2.5 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.enrolled} học viên · {c.activity} sự kiện</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
