import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { getAssignmentsAction } from '@/actions/assignments';
import { buttonVariants } from '@/components/ui/button';
import { hasMinRole } from '@/lib/permissions';
import { ClipboardList, Plus, Clock, FileText, Paperclip, AlignLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@prisma/client';

export const metadata = { title: 'Bài tập' };

const TYPE_LABEL: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  TEXT: { label: 'Văn bản', icon: AlignLeft },
  FILE: { label: 'File',    icon: Paperclip },
  BOTH: { label: 'VB + File', icon: FileText },
};

const STATUS_CLASS: Record<string, string> = {
  DRAFT:     'bg-muted text-muted-foreground',
  PUBLISHED: 'bg-green-500/10 text-green-700 dark:text-green-400',
  CLOSED:    'bg-destructive/10 text-destructive',
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp', PUBLISHED: 'Đã đăng', CLOSED: 'Đã đóng',
};

function formatDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
}

export default async function AssignmentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();
  if (!role) redirect('/login');

  const canManage = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session?.user?.id);
  const isStaff   = hasMinRole(role, 'TA');

  const assignments = await getAssignmentsAction(course.id);

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bài tập</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{course.name}</p>
        </div>
        {canManage && (
          <Link href={`/courses/${slug}/assignments/new`} className={buttonVariants({ size: 'sm' })}>
            <Plus className="h-4 w-4 mr-1.5" /> Tạo bài tập
          </Link>
        )}
      </div>

      {assignments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 py-16 text-center">
          <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium">Chưa có bài tập nào</p>
          {canManage && (
            <Link href={`/courses/${slug}/assignments/new`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-4')}>
              <Plus className="h-4 w-4 mr-1" /> Tạo bài tập đầu tiên
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const TypeIcon = TYPE_LABEL[a.type]?.icon ?? FileText;
            const isOverdue = a.dueDate && new Date() > new Date(a.dueDate);

            return (
              <Link
                key={a.id}
                href={`/courses/${slug}/assignments/${a.id}`}
                className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-accent/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <TypeIcon className="h-5 w-5 text-primary" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{a.title}</p>
                    {isStaff && (
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', STATUS_CLASS[a.status])}>
                        {STATUS_LABEL[a.status]}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{TYPE_LABEL[a.type]?.label}</span>
                    <span>·</span>
                    <span>{a.maxScore} điểm</span>
                    {a.dueDate && (
                      <>
                        <span>·</span>
                        <span className={cn('flex items-center gap-1', isOverdue && a.status === 'PUBLISHED' ? 'text-destructive' : '')}>
                          <Clock className="h-3 w-3" />
                          {formatDate(a.dueDate)}
                        </span>
                      </>
                    )}
                    {isStaff && (
                      <>
                        <span>·</span>
                        <span>{a._count.submissions} bài nộp</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
