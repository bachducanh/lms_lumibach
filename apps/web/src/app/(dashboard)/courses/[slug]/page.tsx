import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { listCourseMembersAction } from '@/actions/enrollments';
import { logActivity } from '@/lib/activity';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EnrollmentCodePanel } from '@/components/features/courses/EnrollmentCodePanel';
import { hasMinRole } from '@/lib/permissions';
import {
  BookOpen,
  Users,
  Calendar,
  Pencil,
  UserPlus,
  ClipboardList,
  PlayCircle,
  ChevronRight,
  ArrowLeft,
  Zap,
  Brain,
  HelpCircle,
  TableProperties,
  MessageSquare,
  BarChart3,
} from 'lucide-react';
import type { UserRole } from '@lumibach/db';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourseBySlugAction(slug);
  return { title: course?.name ?? 'Khoá học' };
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Pending',
  PUBLISHED: 'Active',
  ARCHIVED: 'Archive',
};
const STATUS_STYLE: Record<string, { bg: string; text: string; glow: string }> = {
  PUBLISHED: {
    bg: 'bg-emerald-500/15 border-emerald-500/30',
    text: 'text-emerald-400',
    glow: 'oklch(0.70 0.18 140 / 0.4)',
  },
  DRAFT: {
    bg: 'bg-amber-500/15 border-amber-500/30',
    text: 'text-amber-400',
    glow: 'oklch(0.78 0.16 80  / 0.4)',
  },
  ARCHIVED: { bg: 'bg-slate-500/15 border-slate-500/30', text: 'text-slate-400', glow: 'none' },
};

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole;
  const userId = session?.user?.id;

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  if (userId)
    logActivity({
      userId,
      courseId: course.id,
      action: 'VIEW_COURSE',
      resourceType: 'course',
      resourceId: course.id,
      resourceName: course.name,
    });

  const canManage = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === userId);
  const canViewPeople = hasMinRole(role, 'TA');

  const { enrollments, tas } = await listCourseMembersAction(course.id);

  const ownerName =
    course.owner.fullName ?? `${course.owner.firstName} ${course.owner.lastName}`.trim();

  const statusStyle = STATUS_STYLE[course.status] ?? STATUS_STYLE.ARCHIVED!;

  return (
    <div className="max-w-3xl space-y-6">
      {/* ── Back link ──────────────────────────────────────── */}
      <Link
        href="/courses"
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-xs transition-colors duration-150"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Danh sách khoá học
      </Link>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status badge */}
            <span
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}
              style={{ boxShadow: `0 0 10px ${statusStyle.glow}` }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {STATUS_LABEL[course.status]}
            </span>
            {course.subject && (
              <Badge variant="outline" className="border-primary/20 text-primary/80 text-xs">
                {course.subject}
              </Badge>
            )}
            {course.gradeLevel && (
              <Badge variant="outline" className="text-xs">
                {course.gradeLevel}
              </Badge>
            )}
            {course.isPublic && (
              <Badge variant="secondary" className="text-xs">
                Công khai
              </Badge>
            )}
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            {course.name}
            {course.shortName && (
              <span className="text-muted-foreground ml-2 font-mono text-sm font-normal">
                ({course.shortName})
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm">
            Giảng viên: <span className="text-foreground font-medium">{ownerName}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {canViewPeople && (
            <Link
              href={`/courses/${slug}/gradebook`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <TableProperties className="mr-1.5 h-4 w-4 text-emerald-500" />
              Bảng điểm
            </Link>
          )}
          {canViewPeople && (
            <Link
              href={`/courses/${slug}/analytics`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <BarChart3 className="mr-1.5 h-4 w-4 text-cyan-500" />
              Phân tích
            </Link>
          )}
          {canViewPeople && (
            <Link
              href={`/courses/${slug}/people`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Users className="mr-1.5 h-4 w-4" />
              Thành viên
            </Link>
          )}
          {canManage && (
            <Link
              href={`/courses/${slug}/edit`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Pencil className="mr-1.5 h-4 w-4" />
              Sửa
            </Link>
          )}
        </div>
      </div>

      {/* ── Thumbnail ──────────────────────────────────────── */}
      {course.thumbnail ? (
        <div className="border-border overflow-hidden rounded-xl border">
          <img src={course.thumbnail} alt={course.name} className="max-h-56 w-full object-cover" />
        </div>
      ) : (
        <div className="border-border bg-card/50 relative flex h-36 items-center justify-center overflow-hidden rounded-xl border border-dashed">
          <div className="pointer-events-none absolute inset-0 opacity-[0.04]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
              <defs>
                <pattern id="thumb-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#thumb-grid)" />
            </svg>
          </div>
          <BookOpen className="text-muted-foreground/20 relative h-12 w-12" />
        </div>
      )}

      {/* ── Primary CTA ────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Start learning — full-width CTA */}
        <Link
          href={`/courses/${slug}/modules`}
          className="group flex w-full items-center justify-between gap-4 rounded-xl px-6 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
          style={{
            background: 'linear-gradient(135deg, #fd085d, oklch(0.58 0.195 35))',
            boxShadow: '0 4px 24px rgb(253 8 93 / 35%)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <PlayCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-sm leading-tight font-bold text-white">
                <Zap className="h-3.5 w-3.5" />
                Bắt đầu học
              </p>
              <p className="mt-0.5 text-xs text-white/70">Xem toàn bộ nội dung khoá học</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-white/70 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>

        {/* Secondary links — 3-column grid */}
        <div className="grid grid-cols-3 gap-3">
          <Link
            href={`/courses/${slug}/assignments`}
            className="border-border bg-card hover:border-primary/40 group flex items-center gap-3 rounded-xl border px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="bg-primary/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <ClipboardList className="text-primary h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm leading-tight font-semibold">Bài tập</p>
              <p className="text-muted-foreground mt-0.5 truncate text-xs">Xem &amp; nộp bài</p>
            </div>
          </Link>

          <Link
            href={`/courses/${slug}/quizzes`}
            className="border-border bg-card group flex items-center gap-3 rounded-xl border px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-500/40 hover:shadow-lg"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
              <Brain className="h-5 w-5 text-violet-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm leading-tight font-semibold">Quiz</p>
              <p className="text-muted-foreground mt-0.5 truncate text-xs">Kiểm tra nhanh</p>
            </div>
          </Link>

          <Link
            href={`/courses/${slug}/forum`}
            className="border-border bg-card group flex items-center gap-3 rounded-xl border px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-500/40 hover:shadow-lg"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
              <MessageSquare className="h-5 w-5 text-sky-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm leading-tight font-semibold">Diễn đàn</p>
              <p className="text-muted-foreground mt-0.5 truncate text-xs">Thảo luận lớp học</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Teacher tools row ──────────────────────────────────── */}
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/courses/${slug}/questions`}
            className="border-border bg-card hover:bg-accent/40 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors"
          >
            <HelpCircle className="text-muted-foreground h-4 w-4" />
            <span className="font-medium">Ngân hàng câu hỏi</span>
          </Link>
        </div>
      )}

      {/* ── Stats row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Học sinh"
          value={String(enrollments.length)}
        />
        <StatCard
          icon={<UserPlus className="h-4 w-4" />}
          label="Trợ giảng"
          value={String(tas.length)}
        />
        {course.startDate && (
          <StatCard
            icon={<Calendar className="h-4 w-4" />}
            label="Bắt đầu"
            value={new Date(course.startDate).toLocaleDateString('vi-VN')}
          />
        )}
        {course.endDate && (
          <StatCard
            icon={<Calendar className="h-4 w-4" />}
            label="Kết thúc"
            value={new Date(course.endDate).toLocaleDateString('vi-VN')}
          />
        )}
      </div>

      {/* ── Role-aware sections ─────────────────────────────── */}
      {role === 'STUDENT' && <StudentView enrollments={enrollments} userId={userId} />}

      {(role === 'TEACHER' || role === 'TA' || role === 'ADMIN') && (
        <TeacherView enrollments={enrollments} tas={tas} />
      )}

      {/* ── Description ────────────────────────────────────── */}
      {course.description && (
        <div className="border-border bg-card rounded-xl border p-5">
          <p className="text-muted-foreground mb-3 text-xs font-bold tracking-widest uppercase">
            Mô tả
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
            {course.description}
          </p>
        </div>
      )}

      {/* ── Enrollment code ─────────────────────────────────── */}
      {canManage && (
        <EnrollmentCodePanel
          courseId={course.id}
          initialCode={course.enrollmentCode ?? null}
          canManage={canManage}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border-border bg-card hover:border-primary/20 flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors">
      <span className="text-primary/60">{icon}</span>
      <div>
        <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}

function StudentView({
  enrollments,
  userId,
}: {
  enrollments: Awaited<ReturnType<typeof listCourseMembersAction>>['enrollments'];
  userId?: string;
}) {
  const myEnrollment = enrollments.find((e) => e.userId === userId);
  if (!myEnrollment) return null;

  const progress = Math.round(myEnrollment.progress);

  return (
    <div className="border-border bg-card space-y-3 rounded-xl border p-5">
      <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
        Tiến độ của bạn
      </p>
      <div className="flex items-center gap-3">
        <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #fd085d, oklch(0.80 0.13 210))',
              boxShadow: '0 0 8px rgb(253 8 93 / 50%)',
            }}
          />
        </div>
        <span
          className="text-primary text-sm font-bold tabular-nums"
          style={{ textShadow: '0 0 12px rgb(253 8 93 / 50%)' }}
        >
          {progress}%
        </span>
      </div>
    </div>
  );
}

function TeacherView({
  enrollments,
  tas,
}: {
  enrollments: Awaited<ReturnType<typeof listCourseMembersAction>>['enrollments'];
  tas: Awaited<ReturnType<typeof listCourseMembersAction>>['tas'];
}) {
  const active = enrollments.filter((e) => e.status === 'ACTIVE').length;
  const completed = enrollments.filter((e) => e.status === 'COMPLETED').length;
  const avgProgress =
    enrollments.length > 0
      ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length)
      : 0;

  return (
    <div className="border-border bg-card space-y-4 rounded-xl border p-5">
      <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
        Thống kê lớp học
      </p>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-primary/10 border-primary/20 rounded-lg border py-3">
          <p
            className="text-primary text-2xl font-extrabold"
            style={{ textShadow: '0 0 16px rgb(253 8 93 / 50%)' }}
          >
            {active}
          </p>
          <p className="text-muted-foreground mt-1 text-[10px] font-semibold tracking-wider uppercase">
            Đang học
          </p>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 py-3">
          <p
            className="text-2xl font-extrabold text-emerald-400"
            style={{ textShadow: '0 0 16px oklch(0.70 0.18 140 / 0.5)' }}
          >
            {completed}
          </p>
          <p className="text-muted-foreground mt-1 text-[10px] font-semibold tracking-wider uppercase">
            Hoàn thành
          </p>
        </div>
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 py-3">
          <p
            className="text-2xl font-extrabold text-cyan-400"
            style={{ textShadow: '0 0 16px oklch(0.80 0.13 210 / 0.5)' }}
          >
            {avgProgress}%
          </p>
          <p className="text-muted-foreground mt-1 text-[10px] font-semibold tracking-wider uppercase">
            TB tiến độ
          </p>
        </div>
      </div>
      {tas.length > 0 && (
        <div className="border-border border-t pt-3">
          <p className="text-muted-foreground mb-2 text-xs">Trợ giảng:</p>
          <div className="flex flex-wrap gap-1.5">
            {tas.map((ta) => (
              <Badge
                key={ta.id}
                variant="secondary"
                className="border-primary/20 text-primary/80 border text-xs"
              >
                {ta.user.fullName ?? `${ta.user.firstName} ${ta.user.lastName}`.trim()}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
