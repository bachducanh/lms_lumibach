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
          <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <FolderKanban className="text-primary h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold sm:text-xl">{title}</h2>
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
        <div className="border-border bg-card rounded-xl border border-dashed px-5 py-8 text-center">
          <p className="text-muted-foreground text-sm">Chưa có khoá học nào trong hồ sơ.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {overview.courses.map((course) => (
            <Link
              key={course.courseId}
              href={`/courses/${course.courseSlug}/portfolio/${overview.student.id}`}
              className="border-border bg-card group hover:border-primary/40 rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="group-hover:text-primary line-clamp-2 text-sm font-semibold">
                    {course.courseName}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {STATUS_LABEL[course.status] ?? course.status} · tham gia{' '}
                    {fmtDate(course.enrolledAt)}
                  </p>
                </div>
                <span className="border-primary/20 bg-primary/10 text-primary rounded-full border px-2.5 py-0.5 text-xs font-bold tabular-nums">
                  {Math.round(course.progress)}%
                </span>
              </div>

              <div className="mt-4 space-y-2">
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full"
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
    <div className="border-border bg-card rounded-xl border px-4 py-3 shadow-sm">
      <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
