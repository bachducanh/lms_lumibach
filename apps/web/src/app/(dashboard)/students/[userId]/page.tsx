import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import { apiServerClient, ApiError } from '@/lib/api-client';
import type { ActivityLogPage, PortfolioOverview, StudentDetail } from '@lumibach/types';
import { StudentDetailClient } from '@/components/features/students/StudentDetailClient';
import { LearningPortfolioOverview } from '@/components/features/portfolio/LearningPortfolioOverview';
import { ActivityLogTable } from '@/components/features/activity/ActivityLogTable';
import {
  ChevronLeft,
  GraduationCap,
  Mail,
  Calendar,
  Clock,
  UserCheck,
  UserX,
  ScrollText,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { UserRole } from '@lumibach/db';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Không hoạt động',
  SUSPENDED: 'Bị khóa',
  PENDING: 'Chờ kích hoạt',
};

const STATUS_CLASS: Record<string, string> = {
  ACTIVE:
    'border border-emerald-600/25 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
  INACTIVE: 'border border-border bg-muted text-muted-foreground',
  SUSPENDED:
    'border border-red-600/25 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400',
  PENDING:
    'border border-amber-600/25 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
};

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const api = apiServerClient(await cookies());
  const student = await api.get<StudentDetail>(`/users/students/${userId}`).catch(() => null);
  return { title: student ? `${student.fullName ?? student.firstName} — Học sinh` : 'Học sinh' };
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) redirect('/dashboard');

  const api = apiServerClient(await cookies());
  const [student, courses, recentLogs, portfolioOverview] = await Promise.all([
    api.get<StudentDetail>(`/users/students/${userId}`).catch((err: unknown) => {
      if (err instanceof ApiError) return null;
      throw err;
    }),
    api
      .get<{ id: string; name: string; slug: string }[]>('/users/students/courses-filter')
      .catch(() => [] as { id: string; name: string; slug: string }[]),
    api
      .get<ActivityLogPage>(`/activities/student/${userId}`, { query: { page: 1 } })
      .catch((err: unknown) => {
        if (err instanceof ApiError) return null;
        throw err;
      }),
    api.get<PortfolioOverview>(`/portfolio/students/${userId}/overview`).catch(() => null),
  ]);

  if (!student) notFound();

  const displayName = student.fullName ?? `${student.firstName} ${student.lastName}`.trim();
  const canManage = role === 'ADMIN' || role === 'TEACHER';

  const initials = displayName.split(' ').pop()?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* Back */}
      <Link
        href="/students"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Danh sách học sinh
      </Link>

      {/* Student info card */}
      <div className="border-border bg-card space-y-4 rounded-xl border p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary ring-primary/20 flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold ring-2">
            {initials}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-xl font-bold tracking-tight break-words sm:text-2xl">
                {displayName}
              </h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[student.status] ?? 'bg-muted text-muted-foreground'}`}
              >
                {student.status === 'ACTIVE' ? (
                  <UserCheck className="h-3 w-3" />
                ) : (
                  <UserX className="h-3 w-3" />
                )}
                {STATUS_LABEL[student.status] ?? student.status}
              </span>
            </div>
            {student.username && (
              <p className="text-muted-foreground text-sm">@{student.username}</p>
            )}
            <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <GraduationCap className="h-3.5 w-3.5" />
              <span>Học sinh</span>
            </div>
          </div>
        </div>

        <div className="border-border grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="min-w-0 break-all">{student.email}</span>
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>
              Tham gia {format(new Date(student.createdAt), 'dd/MM/yyyy', { locale: vi })}
            </span>
          </div>
          {student.lastLoginAt && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                Đăng nhập{' '}
                {formatDistanceToNow(new Date(student.lastLoginAt), {
                  addSuffix: true,
                  locale: vi,
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Enrollments — client component for manage actions */}
      <StudentDetailClient
        studentId={student.id}
        studentName={displayName}
        courses={courses}
        canManage={canManage}
        initialEnrollments={student.enrollments}
      />

      {portfolioOverview && (
        <LearningPortfolioOverview
          overview={portfolioOverview}
          title="Phân tích hồ sơ học tập"
          description="Tổng hợp tiến độ, điểm số và năng lực của học sinh trong mọi khoá bạn được quyền xem."
          showStudentName
        />
      )}

      {/* Activity log */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ScrollText className="text-muted-foreground h-4 w-4" />
            <h2 className="text-lg font-bold sm:text-xl">Hoạt động gần đây</h2>
          </div>
          {(recentLogs?.total ?? 0) > 0 && (
            <span className="text-muted-foreground text-sm">{recentLogs!.total} bản ghi</span>
          )}
        </div>
        <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
          <ActivityLogTable rows={recentLogs?.rows ?? []} showUser={false} showCourse />
        </div>
      </div>
    </div>
  );
}
