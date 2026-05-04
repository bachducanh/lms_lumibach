import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import { getStudentDetailAction, listCoursesForFilterAction } from '@/actions/students';
import { getStudentLogsAction } from '@/actions/activity';
import { StudentDetailClient } from '@/components/features/students/StudentDetailClient';
import { ActivityLogTable } from '@/components/features/activity/ActivityLogTable';
import { ChevronLeft, GraduationCap, Mail, Calendar, Clock, UserCheck, UserX, ScrollText } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { UserRole } from '@prisma/client';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE:    'Hoạt động',
  INACTIVE:  'Không hoạt động',
  SUSPENDED: 'Bị khóa',
  PENDING:   'Chờ kích hoạt',
};

const STATUS_CLASS: Record<string, string> = {
  ACTIVE:    'bg-green-500/10 text-green-700 dark:text-green-400',
  INACTIVE:  'bg-muted text-muted-foreground',
  SUSPENDED: 'bg-red-500/10 text-destructive',
  PENDING:   'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const student = await getStudentDetailAction(userId);
  return { title: student ? `${student.fullName ?? student.firstName} — Học sinh` : 'Học sinh' };
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await auth();
  const role    = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) redirect('/dashboard');

  const [student, courses, recentLogs] = await Promise.all([
    getStudentDetailAction(userId),
    listCoursesForFilterAction(),
    getStudentLogsAction(userId, { page: 1 }),
  ]);

  if (!student) notFound();

  const displayName = student.fullName ?? `${student.firstName} ${student.lastName}`.trim();
  const canManage   = role === 'ADMIN' || role === 'TEACHER';

  const initials = displayName.split(' ').pop()?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="max-w-2xl space-y-6">
      {/* Back */}
      <Link
        href="/students"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Danh sách học sinh
      </Link>

      {/* Student info card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary"
            style={{ boxShadow: '0 0 0 2px rgb(var(--primary) / 20%)' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">{displayName}</h1>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[student.status] ?? 'bg-muted text-muted-foreground'}`}>
                {student.status === 'ACTIVE'
                  ? <UserCheck className="h-3 w-3" />
                  : <UserX className="h-3 w-3" />}
                {STATUS_LABEL[student.status] ?? student.status}
              </span>
            </div>
            {student.username && (
              <p className="text-sm text-muted-foreground">@{student.username}</p>
            )}
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5" />
              <span>Học sinh</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{student.email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>
              Tham gia {format(new Date(student.createdAt), "dd/MM/yyyy", { locale: vi })}
            </span>
          </div>
          {student.lastLoginAt && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                Đăng nhập {formatDistanceToNow(new Date(student.lastLoginAt), { addSuffix: true, locale: vi })}
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

      {/* Activity log */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Hoạt động gần đây</h2>
          </div>
          {(recentLogs?.total ?? 0) > 0 && (
            <span className="text-xs text-muted-foreground">{recentLogs!.total} bản ghi</span>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <ActivityLogTable rows={recentLogs?.rows ?? []} showUser={false} showCourse />
        </div>
      </div>
    </div>
  );
}
