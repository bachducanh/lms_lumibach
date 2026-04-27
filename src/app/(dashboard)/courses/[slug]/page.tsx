import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { listCourseMembersAction } from '@/actions/enrollments';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EnrollmentCodePanel } from '@/components/features/courses/EnrollmentCodePanel';
import { hasMinRole } from '@/lib/permissions';
import { BookOpen, Users, Calendar, Pencil, UserPlus, LayoutList, ClipboardList } from 'lucide-react';
import type { UserRole } from '@prisma/client';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourseBySlugAction(slug);
  return { title: course?.name ?? 'Khoá học' };
}

const STATUS_LABEL: Record<string, string> = { DRAFT: 'Pending', PUBLISHED: 'Active', ARCHIVED: 'Archive' };
const STATUS_BG: Record<string, string> = { DRAFT: 'bg-orange-500', PUBLISHED: 'bg-green-500', ARCHIVED: 'bg-red-500' };

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

  const canManage =
    role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === userId);
  const canViewPeople = hasMinRole(role, 'TA');

  // Lấy số liệu thống kê
  const { enrollments, tas } = await listCourseMembersAction(course.id);

  const ownerName =
    course.owner.fullName ??
    `${course.owner.firstName} ${course.owner.lastName}`.trim();

  const bg = STATUS_BG[course.status] ?? 'bg-slate-500';

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white ${bg}`}>
              {STATUS_LABEL[course.status]}
            </span>
            {course.subject && <Badge variant="outline">{course.subject}</Badge>}
            {course.gradeLevel && <Badge variant="outline">{course.gradeLevel}</Badge>}
            {course.isPublic && <Badge variant="secondary">Công khai</Badge>}
          </div>
          <h1 className="text-2xl font-bold">
            {course.name}
            {course.shortName && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">({course.shortName})</span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">Giảng viên: {ownerName}</p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <Link href={`/courses/${slug}/modules`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <LayoutList className="h-4 w-4 mr-1.5" />
            Nội dung
          </Link>
          <Link href={`/courses/${slug}/assignments`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <ClipboardList className="h-4 w-4 mr-1.5" />
            Bài tập
          </Link>
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

      {/* Thumbnail */}
      {course.thumbnail ? (
        <img
          src={course.thumbnail}
          alt={course.name}
          className="w-full max-h-56 object-cover rounded-xl border border-border"
        />
      ) : (
        <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-border bg-muted/50">
          <BookOpen className="h-12 w-12 text-muted-foreground/20" />
        </div>
      )}

      {/* Stats */}
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

      {/* Role-aware sections */}
      {role === 'STUDENT' && (
        <StudentView enrollments={enrollments} userId={userId} />
      )}

      {(role === 'TEACHER' || role === 'TA' || role === 'ADMIN') && (
        <TeacherView enrollments={enrollments} tas={tas} />
      )}

      {/* Description */}
      {course.description && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium mb-2">Mô tả</p>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{course.description}</p>
        </div>
      )}

      {/* Enrollment code (TEACHER/ADMIN only) */}
      {canManage && (
        <EnrollmentCodePanel
          courseId={course.id}
          initialCode={course.enrollmentCode ?? null}
          canManage={canManage}
        />
      )}

      <Link href="/courses" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        ← Danh sách khoá học
      </Link>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
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

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <p className="text-sm font-medium">Tiến độ của bạn</p>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${myEnrollment.progress}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-primary">{Math.round(myEnrollment.progress)}%</span>
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
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-sm font-medium">Thống kê lớp học</p>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-2xl font-bold text-primary">{active}</p>
          <p className="text-xs text-muted-foreground">Đang học</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-600">{completed}</p>
          <p className="text-xs text-muted-foreground">Hoàn thành</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{avgProgress}%</p>
          <p className="text-xs text-muted-foreground">TB tiến độ</p>
        </div>
      </div>
      {tas.length > 0 && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">Trợ giảng:</p>
          <div className="flex flex-wrap gap-1">
            {tas.map((ta) => (
              <Badge key={ta.id} variant="secondary" className="text-xs">
                {ta.user.fullName ?? `${ta.user.firstName} ${ta.user.lastName}`.trim()}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
