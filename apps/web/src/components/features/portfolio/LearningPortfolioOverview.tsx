import Link from 'next/link';
import { BarChart3, BookOpenCheck, FolderKanban, Target, TrendingUp } from 'lucide-react';
import type { PortfolioOverview } from '@lumibach/types';

type Props = {
  overview: PortfolioOverview;
  title?: string;
  description?: string;
  showStudentName?: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Đang học',
  COMPLETED: 'Hoàn thành',
  DROPPED: 'Đã rời',
  SUSPENDED: 'Tạm dừng',
};

function fmtPercent(value: number | null) {
  return value === null ? '--' : `${Math.round(value)}%`;
}

function fmtDate(date: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function LearningPortfolioOverview({
  overview,
  title = 'Hồ sơ học tập',
  description = 'Tổng quan tiến độ, điểm số và minh chứng năng lực trên các khoá học.',
  showStudentName = false,
}: Props) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/10">
            <FolderKanban className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {showStudentName ? `${overview.student.name} · ` : ''}
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric label="Khoá học" value={String(overview.totals.courseCount)} icon={BookOpenCheck} />
        <Metric
          label="Tiến độ TB"
          value={`${overview.totals.averageProgress}%`}
          icon={TrendingUp}
        />
        <Metric label="Bài làm" value={String(overview.totals.totalGraded)} icon={BarChart3} />
        <Metric label="Minh chứng" value={String(overview.totals.competencyCount)} icon={Target} />
        <Metric
          label="Tự đánh giá"
          value={String(overview.totals.reflectionCount)}
          icon={FolderKanban}
        />
      </div>

      {overview.courses.length === 0 ? (
        <div className="border-border bg-card/60 rounded-lg border border-dashed px-5 py-8 text-center">
          <p className="text-muted-foreground text-sm">Chưa có khoá học nào trong hồ sơ.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {overview.courses.map((course) => (
            <Link
              key={course.courseId}
              href={`/courses/${course.courseSlug}/portfolio/${overview.student.id}`}
              className="border-border bg-card/70 group rounded-lg border p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-[0_16px_40px_oklch(0_0_0_/_0.18)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold group-hover:text-cyan-400">
                    {course.courseName}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {STATUS_LABEL[course.status] ?? course.status} · tham gia{' '}
                    {fmtDate(course.enrolledAt)}
                  </p>
                </div>
                <span className="border-primary/20 bg-primary/10 text-primary rounded-md border px-2 py-1 text-xs font-bold tabular-nums">
                  {Math.round(course.progress)}%
                </span>
              </div>

              <div className="mt-4 space-y-2">
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#fd085d] via-cyan-400 to-emerald-400"
                    style={{ width: `${Math.max(0, Math.min(100, Math.round(course.progress)))}%` }}
                  />
                </div>
                <div className="text-muted-foreground grid grid-cols-3 gap-2 text-xs">
                  <span>Điểm TB: {fmtPercent(course.summary.averagePercent)}</span>
                  <span>NL: {course.summary.competencyCount}</span>
                  <span>Tự ĐG: {course.summary.reflectionCount}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof BookOpenCheck;
}) {
  return (
    <div className="border-border bg-card rounded-lg border px-4 py-3">
      <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
