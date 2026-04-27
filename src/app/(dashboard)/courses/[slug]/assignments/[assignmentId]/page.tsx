import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { getAssignmentAction, getMySubmissionAction } from '@/actions/assignments';
import { RichTextEditor } from '@/components/ui/editor/RichTextEditor';
import { buttonVariants } from '@/components/ui/button';
import { SubmissionForm } from '@/components/features/assignments/SubmissionForm';
import { hasMinRole } from '@/lib/permissions';
import { Clock, Pencil, Users, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@prisma/client';

export async function generateMetadata({ params }: { params: Promise<{ slug: string; assignmentId: string }> }) {
  const { assignmentId } = await params;
  const a = await getAssignmentAction(assignmentId);
  return { title: a?.title ?? 'Bài tập' };
}

const TYPE_LABEL: Record<string, string> = { TEXT: 'Văn bản', FILE: 'File', BOTH: 'Văn bản + File' };
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp', SUBMITTED: 'Đã nộp', LATE: 'Nộp trễ', GRADED: 'Đã chấm', RETURNED: 'Đã trả', DRAFT_SAVE: 'Bản nháp',
};
const STATUS_CLASS: Record<string, string> = {
  DRAFT:     'bg-muted text-muted-foreground',
  SUBMITTED: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  LATE:      'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  GRADED:    'bg-green-500/10 text-green-700 dark:text-green-400',
  RETURNED:  'bg-purple-500/10 text-purple-700 dark:text-purple-400',
};

function formatDate(d: Date | null | undefined) {
  if (!d) return null;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
}

export default async function AssignmentViewPage({
  params,
}: { params: Promise<{ slug: string; assignmentId: string }> }) {
  const { slug, assignmentId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  const userId = session?.user?.id;

  if (!role || !userId) redirect('/login');

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const assignment = await getAssignmentAction(assignmentId);
  if (!assignment) notFound();
  if (assignment.courseId !== course.id) notFound();

  const canManage = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === userId);
  const isStaff   = hasMinRole(role, 'TA');

  if (assignment.status === 'DRAFT' && !isStaff) notFound();

  const mySubmission = role === 'STUDENT' ? await getMySubmissionAction(assignmentId) : null;

  const now = new Date();
  const isAvailable = !assignment.availableFrom || now >= new Date(assignment.availableFrom);
  const isPastDue   = assignment.dueDate ? now > new Date(assignment.dueDate) : false;
  const isPastLate  = assignment.lateDeadline ? now > new Date(assignment.lateDeadline) : false;
  const canSubmit   = role === 'STUDENT' && isAvailable && assignment.status === 'PUBLISHED'
    && !(isPastDue && assignment.latePolicy === 'NONE' && (!assignment.lateDeadline || isPastLate));

  return (
    <div>
      {/* Top nav — full width */}
      <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-10 flex items-center gap-3 border-b bg-background/95 px-4 py-2.5 backdrop-blur">
        <Link href={`/courses/${slug}/assignments`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> Bài tập
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-medium truncate">{assignment.title}</span>
        <div className="ml-auto flex items-center gap-2">
          {canManage && (
            <>
              <Link href={`/courses/${slug}/assignments/${assignmentId}/submissions`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <Users className="h-3.5 w-3.5 mr-1" /> {assignment._count.submissions} bài nộp
              </Link>
              <Link href={`/courses/${slug}/assignments/${assignmentId}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Sửa
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Content constrained */}
      <div className="mx-auto max-w-5xl">

      {/* Meta */}
      <div className="mb-6 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
          <span>{TYPE_LABEL[assignment.type]}</span>
          <span>·</span>
          <span>{assignment.maxScore} điểm</span>
          {assignment.dueDate && (
            <>
              <span>·</span>
              <span className={cn('flex items-center gap-1', isPastDue ? 'text-destructive' : '')}>
                <Clock className="h-3 w-3" />
                Hạn nộp: {formatDate(assignment.dueDate)}
              </span>
            </>
          )}
          {assignment.availableFrom && !isAvailable && (
            <>
              <span>·</span>
              <span className="text-muted-foreground">Mở từ {formatDate(assignment.availableFrom)}</span>
            </>
          )}
        </div>
        <h1 className="text-3xl font-bold leading-tight">{assignment.title}</h1>
      </div>

      {/* Instructions */}
      <div className="mb-8 rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-3">
          <span className="text-sm font-semibold">Đề bài</span>
        </div>
        <div className="p-6">
          {assignment.instructions ? (
            <RichTextEditor content={assignment.instructions} editable={false} className="border-0 bg-transparent" />
          ) : (
            <p className="text-sm text-muted-foreground italic">Không có mô tả.</p>
          )}
        </div>
      </div>

      {/* My submission / Submit form */}
      {role === 'STUDENT' && (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Bài nộp của bạn</span>
            {mySubmission && (
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_CLASS[mySubmission.status])}>
                {STATUS_LABEL[mySubmission.status]}
              </span>
            )}
          </div>
          <div className="p-6">
            {/* Graded feedback */}
            {mySubmission?.status === 'GRADED' && (
              <div className="mb-6 rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-green-700 dark:text-green-400">Kết quả chấm bài</span>
                  <span className="text-2xl font-bold">{mySubmission.score}/{assignment.maxScore}</span>
                </div>
                {mySubmission.feedback && (
                  <RichTextEditor content={mySubmission.feedback} editable={false} className="border-0 bg-transparent" />
                )}
              </div>
            )}

            {/* Submitted read-only view */}
            {mySubmission && mySubmission.status !== 'DRAFT' && mySubmission.status !== 'GRADED' && (
              <div className="mb-4 space-y-2">
                <p className="text-xs text-muted-foreground">Nộp lúc {formatDate(mySubmission.submittedAt)}</p>
                {mySubmission.content && (
                  <RichTextEditor content={mySubmission.content} editable={false} className="border-0 bg-transparent" />
                )}
              </div>
            )}

            {/* Submission form */}
            {canSubmit && (
              <SubmissionForm
                assignmentId={assignmentId}
                assignmentType={assignment.type}
                draftContent={mySubmission?.status === 'DRAFT' ? (mySubmission.content ?? '') : ''}
                hasSubmitted={!!mySubmission && mySubmission.status !== 'DRAFT'}
                allowResubmit={assignment.allowResubmit}
              />
            )}

            {!canSubmit && !mySubmission && (
              <p className="text-sm text-muted-foreground italic">
                {!isAvailable ? `Bài tập chưa mở (từ ${formatDate(assignment.availableFrom)}).` : 'Đã hết hạn nộp bài.'}
              </p>
            )}
          </div>
        </div>
      )}

      </div>{/* end max-w-5xl */}
    </div>
  );
}
