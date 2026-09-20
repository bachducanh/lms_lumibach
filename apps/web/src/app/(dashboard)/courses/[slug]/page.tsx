import Link from 'next/link';

export const dynamic = 'force-dynamic';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { logActivity } from '@/lib/activity';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { EnrollmentCodePanel } from '@/components/features/courses/EnrollmentCodePanel';
import type { CourseDetail, CourseMember, CourseTA, CourseMembersResponse } from '@lumibach/types';
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
  Target,
  FolderKanban,
  Library,
} from 'lucide-react';
import type { UserRole } from '@lumibach/db';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  return { title: course?.name ?? 'Khoá học' };
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Pending',
  PUBLISHED: 'Active',
  ARCHIVED: 'Archive',
};
const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  PUBLISHED: {
    bg: 'border-emerald-600/25 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10',
    text: 'text-emerald-800 dark:text-emerald-400',
  },
  DRAFT: {
    bg: 'border-amber-600/25 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10',
    text: 'text-amber-800 dark:text-amber-400',
  },
  ARCHIVED: {
    bg: 'border-border bg-muted',
    text: 'text-muted-foreground',
  },
};

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole;
  const userId = session?.user?.id;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
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

  const canManage = course.viewerCanManage;
  const canViewPeople = course.viewerCanGrade;
  // Thao tác cấp khoá (sửa khoá, mã ghi danh) chỉ dành cho ADMIN/chủ khoá.
  const canEditCourse = course.viewerIsOwner;

  const { enrollments, tas } = await api
    .get<CourseMembersResponse>(`/courses/${course.id}/members`)
    .catch(() => ({ enrollments: [] as CourseMember[], tas: [] as CourseTA[], coTeachers: [] }));

  const ownerName =
    course.owner.fullName ?? `${course.owner.firstName} ${course.owner.lastName}`.trim();

  const statusStyle = STATUS_STYLE[course.status] ?? STATUS_STYLE.ARCHIVED!;

  return (
    <div className="lb-reveal lb-reveal-children mx-auto w-full max-w-5xl space-y-6">
      {/* ── Back link ──────────────────────────────────────── */}
      <Link
        href="/courses"
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm transition-colors duration-150"
      >
        <ArrowLeft className="h-4 w-4" />
        Danh sách khoá học
      </Link>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-72 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status badge */}
            <span
              className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {STATUS_LABEL[course.status]}
            </span>
            {course.subject && (
              <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                {course.subject}
              </Badge>
            )}
            {course.category && (
              <Badge
                variant="outline"
                className="max-w-full text-xs"
                title={course.category.breadcrumb.map((b) => b.name).join(' / ')}
              >
                <span className="truncate">
                  {course.category.breadcrumb.map((b) => b.name).join(' / ')}
                </span>
              </Badge>
            )}
            {course.isPublic && (
              <Badge variant="secondary" className="text-xs">
                Công khai
              </Badge>
            )}
          </div>

          <h1 className="font-heading text-2xl font-bold tracking-tight break-words sm:text-3xl">
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

        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
          {canViewPeople && (
            <Link
              href={`/courses/${slug}/gradebook`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'max-sm:h-10')}
            >
              <TableProperties className="mr-1.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Bảng điểm
            </Link>
          )}
          {canViewPeople && (
            <Link
              href={`/courses/${slug}/reports`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'max-sm:h-10')}
            >
              <BarChart3 className="mr-1.5 h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              Báo cáo
            </Link>
          )}
          {canViewPeople && (
            <Link
              href={`/courses/${slug}/people`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'max-sm:h-10')}
            >
              <Users className="mr-1.5 h-4 w-4" />
              Thành viên
            </Link>
          )}
          {canEditCourse && (
            <Link
              href={`/courses/${slug}/edit`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'max-sm:h-10')}
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
          <img src={course.thumbnail} alt={course.name} className="max-h-64 w-full object-cover" />
        </div>
      ) : (
        <div className="border-border bg-muted/40 relative flex h-32 items-center justify-center overflow-hidden rounded-xl border border-dashed sm:h-40">
          <div className="pointer-events-none absolute inset-0 opacity-[0.05]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
              <defs>
                <pattern id="thumb-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#thumb-grid)" />
            </svg>
          </div>
          <BookOpen className="text-muted-foreground/40 relative h-12 w-12" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Main column ──────────────────────────────────── */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Primary CTA */}
          <div className="space-y-3">
            {/* Start learning — full-width CTA */}
            <Link
              href={`/courses/${slug}/modules`}
              className="group bg-primary text-primary-foreground flex w-full items-center justify-between gap-4 rounded-xl px-5 py-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:px-6"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <PlayCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-base leading-tight font-bold">
                    <Zap className="h-4 w-4" />
                    Bắt đầu học
                  </p>
                  <p className="mt-0.5 text-sm text-white/80">Xem toàn bộ nội dung khoá học</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-white/80 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>

            {/* Secondary links — responsive shortcut grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Link
                href={`/courses/${slug}/assignments`}
                className="border-border bg-card hover:border-primary/40 group flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3.5 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-col sm:items-start sm:gap-3 sm:py-4 xl:flex-row xl:items-center"
              >
                <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                  <ClipboardList className="text-primary h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-base leading-tight font-semibold">Bài tập</p>
                  <p className="text-muted-foreground mt-0.5 truncate text-sm">Xem &amp; nộp bài</p>
                </div>
              </Link>

              <Link
                href={`/courses/${slug}/quizzes`}
                className="border-border bg-card group flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3.5 shadow-sm transition-shadow duration-200 hover:border-violet-500/40 hover:shadow-md sm:flex-col sm:items-start sm:gap-3 sm:py-4 xl:flex-row xl:items-center"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                  <Brain className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-base leading-tight font-semibold">Quiz</p>
                  <p className="text-muted-foreground mt-0.5 truncate text-sm">Kiểm tra nhanh</p>
                </div>
              </Link>

              <Link
                href={`/courses/${slug}/forum`}
                className="border-border bg-card group flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3.5 shadow-sm transition-shadow duration-200 hover:border-sky-500/40 hover:shadow-md sm:flex-col sm:items-start sm:gap-3 sm:py-4 xl:flex-row xl:items-center"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
                  <MessageSquare className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-base leading-tight font-semibold">Diễn đàn</p>
                  <p className="text-muted-foreground mt-0.5 truncate text-sm">Thảo luận lớp học</p>
                </div>
              </Link>
            </div>
          </div>

          {/* ── Teacher tools row ──────────────────────────────────── */}
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/courses/${slug}/questions`}
                className="border-border bg-card hover:bg-muted/60 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-sm transition-colors"
              >
                <HelpCircle className="text-muted-foreground h-4 w-4" />
                <span className="font-medium">Ngân hàng câu hỏi</span>
              </Link>
              <Link
                href={`/courses/${slug}/modules/bank`}
                className="border-border bg-card hover:bg-muted/60 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-sm transition-colors"
              >
                <Library className="text-muted-foreground h-4 w-4" />
                <span className="font-medium">Ngân hàng nội dung</span>
              </Link>
              <Link
                href={`/courses/${slug}/competencies`}
                className="border-border bg-card hover:bg-muted/60 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-sm transition-colors"
              >
                <Target className="text-muted-foreground h-4 w-4" />
                <span className="font-medium">Năng lực</span>
              </Link>
            </div>
          )}

          {/* ── Description ────────────────────────────────────── */}
          {course.description && (
            <div className="border-border bg-card rounded-xl border p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-bold sm:text-xl">Mô tả</h2>
              <p className="text-muted-foreground text-sm leading-relaxed break-words whitespace-pre-line">
                {course.description}
              </p>
            </div>
          )}
        </div>

        {/* ── Aside ────────────────────────────────────────── */}
        <div className="min-w-0 space-y-4 lg:col-span-1">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
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

          {/* ── Enrollment code (cấp khoá → chỉ chủ khoá/ADMIN) ─────── */}
          {canEditCourse && (
            <EnrollmentCodePanel
              courseId={course.id}
              initialCode={course.enrollmentCode ?? null}
              canManage={canEditCourse}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border-border bg-card flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm">
      <span className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-semibold">{label}</p>
        <p className="mt-0.5 truncate text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}

function StudentView({ enrollments, userId }: { enrollments: CourseMember[]; userId?: string }) {
  const myEnrollment = enrollments.find((e) => e.userId === userId);
  if (!myEnrollment) return null;

  const progress = Math.round(myEnrollment.progress);

  return (
    <div className="border-border bg-card space-y-3 rounded-xl border p-5 shadow-sm">
      <h2 className="text-base font-semibold">Tiến độ của bạn</h2>
      <div className="flex items-center gap-3">
        <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-primary text-sm font-bold tabular-nums">{progress}%</span>
      </div>
      <Link
        href="/profile"
        className="border-border hover:border-primary/40 hover:bg-muted/50 mt-1 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors"
      >
        <FolderKanban className="text-primary h-4 w-4" />
        <span className="font-medium">Xem trong hồ sơ cá nhân</span>
        <ChevronRight className="text-muted-foreground ml-auto h-4 w-4" />
      </Link>
    </div>
  );
}

function TeacherView({ enrollments, tas }: { enrollments: CourseMember[]; tas: CourseTA[] }) {
  const active = enrollments.filter((e) => e.status === 'ACTIVE').length;
  const completed = enrollments.filter((e) => e.status === 'COMPLETED').length;
  const avgProgress =
    enrollments.length > 0
      ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length)
      : 0;

  return (
    <div className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-sm">
      <h2 className="text-base font-semibold">Thống kê lớp học</h2>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-primary/10 border-primary/20 rounded-lg border px-1 py-3">
          <p className="text-primary text-2xl font-bold">{active}</p>
          <p className="text-muted-foreground mt-1 text-xs font-medium">Đang học</p>
        </div>
        <div className="rounded-lg border border-emerald-600/20 bg-emerald-500/10 px-1 py-3 dark:border-emerald-500/20">
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{completed}</p>
          <p className="text-muted-foreground mt-1 text-xs font-medium">Hoàn thành</p>
        </div>
        <div className="rounded-lg border border-cyan-600/20 bg-cyan-500/10 px-1 py-3 dark:border-cyan-500/20">
          <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">{avgProgress}%</p>
          <p className="text-muted-foreground mt-1 text-xs font-medium">TB tiến độ</p>
        </div>
      </div>
      {tas.length > 0 && (
        <div className="border-border border-t pt-3">
          <p className="text-muted-foreground mb-2 text-sm">Trợ giảng:</p>
          <div className="flex flex-wrap gap-1.5">
            {tas.map((ta) => (
              <Badge
                key={ta.id}
                variant="secondary"
                className="border-primary/20 text-primary border text-xs"
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
