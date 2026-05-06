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
  BookOpen, Users, Calendar, Pencil, UserPlus,
  ClipboardList, PlayCircle, ChevronRight, ArrowLeft, Zap, Brain, HelpCircle, TableProperties, MessageSquare, BarChart3,
} from 'lucide-react';
import type { UserRole } from '@prisma/client';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourseBySlugAction(slug);
  return { title: course?.name ?? 'Khoá học' };
}

const STATUS_LABEL: Record<string, string> = { DRAFT: 'Pending', PUBLISHED: 'Active', ARCHIVED: 'Archive' };
const STATUS_STYLE: Record<string, { bg: string; text: string; glow: string }> = {
  PUBLISHED: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400', glow: 'oklch(0.70 0.18 140 / 0.4)' },
  DRAFT:     { bg: 'bg-amber-500/15 border-amber-500/30',     text: 'text-amber-400',   glow: 'oklch(0.78 0.16 80  / 0.4)' },
  ARCHIVED:  { bg: 'bg-slate-500/15 border-slate-500/30',     text: 'text-slate-400',   glow: 'none' },
};

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole;
  const userId = session?.user?.id;

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  if (userId) logActivity({ userId, courseId: course.id, action: 'VIEW_COURSE', resourceType: 'course', resourceId: course.id, resourceName: course.name });

  const canManage =
    role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === userId);
  const canViewPeople = hasMinRole(role, 'TA');

  const { enrollments, tas } = await listCourseMembersAction(course.id);

  const ownerName =
    course.owner.fullName ??
    `${course.owner.firstName} ${course.owner.lastName}`.trim();

  const statusStyle = STATUS_STYLE[course.status] ?? STATUS_STYLE.ARCHIVED!;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Back link ──────────────────────────────────────── */}
      <Link
        href="/courses"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors duration-150"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Danh sách khoá học
      </Link>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status badge */}
            <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}
              style={{ boxShadow: `0 0 10px ${statusStyle.glow}` }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {STATUS_LABEL[course.status]}
            </span>
            {course.subject && (
              <Badge variant="outline" className="text-xs border-primary/20 text-primary/80">
                {course.subject}
              </Badge>
            )}
            {course.gradeLevel && (
              <Badge variant="outline" className="text-xs">{course.gradeLevel}</Badge>
            )}
            {course.isPublic && (
              <Badge variant="secondary" className="text-xs">Công khai</Badge>
            )}
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            {course.name}
            {course.shortName && (
              <span className="ml-2 text-sm font-normal text-muted-foreground font-mono">
                ({course.shortName})
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            Giảng viên:{' '}
            <span className="text-foreground font-medium">{ownerName}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {canViewPeople && (
            <Link href={`/courses/${slug}/gradebook`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <TableProperties className="h-4 w-4 mr-1.5 text-emerald-500" />
              Bảng điểm
            </Link>
          )}
          {canViewPeople && (
            <Link href={`/courses/${slug}/analytics`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <BarChart3 className="h-4 w-4 mr-1.5 text-cyan-500" />
              Phân tích
            </Link>
          )}
          {canViewPeople && (
            <Link href={`/courses/${slug}/people`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <Users className="h-4 w-4 mr-1.5" />
              Thành viên
            </Link>
          )}
          {canManage && (
            <Link href={`/courses/${slug}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Sửa
            </Link>
          )}
        </div>
      </div>

      {/* ── Thumbnail ──────────────────────────────────────── */}
      {course.thumbnail ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <img
            src={course.thumbnail}
            alt={course.name}
            className="w-full max-h-56 object-cover"
          />
        </div>
      ) : (
        <div
          className="flex h-36 items-center justify-center rounded-xl border border-dashed border-border bg-card/50 relative overflow-hidden"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
              <defs>
                <pattern id="thumb-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#thumb-grid)" />
            </svg>
          </div>
          <BookOpen className="relative h-12 w-12 text-muted-foreground/20" />
        </div>
      )}

      {/* ── Primary CTA ────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Start learning — full-width CTA */}
        <Link
          href={`/courses/${slug}/modules`}
          className="flex w-full items-center justify-between gap-4 rounded-xl px-6 py-4 transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 group"
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
              <p className="text-sm font-bold leading-tight text-white flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                Bắt đầu học
              </p>
              <p className="text-xs text-white/70 mt-0.5">Xem toàn bộ nội dung khoá học</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-white/70 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>

        {/* Secondary links — 3-column grid */}
        <div className="grid grid-cols-3 gap-3">
          <Link
            href={`/courses/${slug}/assignments`}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 transition-all duration-200 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-lg group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold leading-tight text-sm">Bài tập</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">Xem &amp; nộp bài</p>
            </div>
          </Link>

          <Link
            href={`/courses/${slug}/quizzes`}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 transition-all duration-200 hover:border-violet-500/40 hover:-translate-y-0.5 hover:shadow-lg group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
              <Brain className="h-5 w-5 text-violet-500" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold leading-tight text-sm">Quiz</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">Kiểm tra nhanh</p>
            </div>
          </Link>

          <Link
            href={`/courses/${slug}/forum`}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 transition-all duration-200 hover:border-sky-500/40 hover:-translate-y-0.5 hover:shadow-lg group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
              <MessageSquare className="h-5 w-5 text-sky-400" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold leading-tight text-sm">Diễn đàn</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">Thảo luận lớp học</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Teacher tools row ──────────────────────────────────── */}
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/courses/${slug}/questions`}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:bg-accent/40"
          >
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Ngân hàng câu hỏi</span>
          </Link>
        </div>
      )}

      {/* ── Stats row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Học sinh" value={String(enrollments.length)} />
        <StatCard icon={<UserPlus className="h-4 w-4" />} label="Trợ giảng" value={String(tas.length)} />
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
      {role === 'STUDENT' && (
        <StudentView enrollments={enrollments} userId={userId} />
      )}

      {(role === 'TEACHER' || role === 'TA' || role === 'ADMIN') && (
        <TeacherView enrollments={enrollments} tas={tas} />
      )}

      {/* ── Description ────────────────────────────────────── */}
      {course.description && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Mô tả</p>
          <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
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
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/20">
      <span className="text-primary/60">{icon}</span>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-bold mt-0.5">{value}</p>
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
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tiến độ của bạn</p>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
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
          className="text-sm font-bold text-primary tabular-nums"
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
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Thống kê lớp học</p>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="rounded-lg bg-primary/10 border border-primary/20 py-3">
          <p
            className="text-2xl font-extrabold text-primary"
            style={{ textShadow: '0 0 16px rgb(253 8 93 / 50%)' }}
          >
            {active}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">Đang học</p>
        </div>
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 py-3">
          <p className="text-2xl font-extrabold text-emerald-400"
            style={{ textShadow: '0 0 16px oklch(0.70 0.18 140 / 0.5)' }}
          >
            {completed}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">Hoàn thành</p>
        </div>
        <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 py-3">
          <p className="text-2xl font-extrabold text-cyan-400"
            style={{ textShadow: '0 0 16px oklch(0.80 0.13 210 / 0.5)' }}
          >
            {avgProgress}%
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">TB tiến độ</p>
        </div>
      </div>
      {tas.length > 0 && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Trợ giảng:</p>
          <div className="flex flex-wrap gap-1.5">
            {tas.map((ta) => (
              <Badge key={ta.id} variant="secondary" className="text-xs border border-primary/20 text-primary/80">
                {ta.user.fullName ?? `${ta.user.firstName} ${ta.user.lastName}`.trim()}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
