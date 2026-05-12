import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { getAssignmentAction, getSubmissionsAction } from '@/actions/assignments';
import { RichTextEditor } from '@/components/ui/editor/RichTextEditor';
import { GradeForm } from '@/components/features/assignments/GradeForm';
import { RubricGrader } from '@/components/features/assignments/RubricGrader';
import { DeleteSubmissionButton } from '@/components/features/assignments/DeleteSubmissionButton';
import { getRubricAction, getSubmissionRubricGradesAction } from '@/actions/rubric';
import { hasMinRole } from '@/lib/permissions';
import { ChevronLeft, CheckCircle2, Clock, Circle, CalendarCheck } from 'lucide-react';
import { prisma } from '@/lib/db';
import { cn } from '@/lib/utils';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Bài nộp' };

function formatDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));
}

export default async function SubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; assignmentId: string }>;
  searchParams: Promise<{ student?: string }>;
}) {
  const { slug, assignmentId } = await params;
  const { student: selectedStudentId } = await searchParams;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) redirect('/login');

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const assignment = await getAssignmentAction(assignmentId);
  if (!assignment || assignment.courseId !== course.id) notFound();

  const [submissions, rubric, enrollments] = await Promise.all([
    getSubmissionsAction(assignmentId),
    getRubricAction(assignmentId),
    prisma.enrollment.findMany({
      where: { courseId: course.id, status: 'ACTIVE' },
      select: { userId: true, user: { select: { id: true, fullName: true, email: true } } },
      orderBy: { user: { fullName: 'asc' } },
    }),
  ]);

  const submissionMap = new Map(submissions.map((s) => [s.studentId, s]));
  const selectedSub = selectedStudentId ? (submissionMap.get(selectedStudentId) ?? null) : null;
  const canManage =
    role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session?.user?.id);

  const submittedCount = submissions.filter((s) => s.status !== 'DRAFT').length;
  const gradedCount = submissions.filter((s) => s.status === 'GRADED').length;

  // Fetch rubric grades for the currently selected submission (server-side)
  const rubricGrades =
    selectedSub && rubric ? await getSubmissionRubricGradesAction(selectedSub.id) : [];

  return (
    <div className="-mx-4 -mt-4 -mb-4 flex max-w-7xl flex-col md:-mx-6 md:-mt-6 md:-mb-6 md:h-[calc(100vh-3.5rem)] md:flex-row md:overflow-hidden">
      {/* Left: student list — full width on mobile when no student selected, hidden when student selected */}
      <aside
        className={cn(
          'border-border bg-card flex flex-col overflow-y-auto',
          'border-b md:w-64 md:shrink-0 md:border-r md:border-b-0',
          selectedStudentId ? 'hidden md:flex' : 'flex max-h-52 md:max-h-none'
        )}
      >
        <div className="border-border border-b px-4 py-3">
          <Link
            href={`/courses/${slug}/assignments/${assignmentId}`}
            className="text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1.5 text-xs transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> {assignment.title}
          </Link>
          <p className="text-muted-foreground text-xs">
            {submittedCount}/{enrollments.length} đã nộp · {gradedCount} đã chấm
          </p>
        </div>

        <nav className="flex-1 space-y-0.5 p-2">
          {enrollments.map(({ user }) => {
            const sub = submissionMap.get(user.id);
            const isSelected = selectedStudentId === user.id;
            return (
              <Link
                key={user.id}
                href={`/courses/${slug}/assignments/${assignmentId}/submissions?student=${user.id}`}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                )}
              >
                {sub?.status === 'GRADED' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                ) : sub && sub.status !== 'DRAFT' ? (
                  <Clock className="h-4 w-4 shrink-0 text-blue-500" />
                ) : (
                  <Circle className="text-muted-foreground/40 h-4 w-4 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="truncate leading-tight font-medium">
                    {user.fullName ?? user.email}
                  </p>
                  {sub?.score != null && (
                    <p
                      className={cn(
                        'text-xs',
                        isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}
                    >
                      {sub.score}/{assignment.maxScore}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Right: submission detail + grading — hidden on mobile when no student selected */}
      <main
        className={cn(
          'overflow-y-auto p-4 md:p-6',
          selectedStudentId ? 'flex-1' : 'hidden md:flex md:flex-1'
        )}
      >
        {/* Mobile: back to list */}
        {selectedStudentId && (
          <Link
            href={`/courses/${slug}/assignments/${assignmentId}/submissions`}
            className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition-colors md:hidden"
          >
            <ChevronLeft className="h-4 w-4" />
            Danh sách học sinh
          </Link>
        )}
        {!selectedStudentId ? (
          <div className="text-muted-foreground flex h-full items-center justify-center">
            <p>Chọn học sinh từ danh sách để xem bài nộp</p>
          </div>
        ) : !selectedSub || selectedSub.status === 'DRAFT' ? (
          <div className="text-muted-foreground flex h-full items-center justify-center">
            <p>Học sinh chưa nộp bài</p>
          </div>
        ) : (
          <div className="max-w-3xl space-y-6">
            {/* Submission meta */}
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                {(() => {
                  const u = enrollments.find((e) => e.userId === selectedStudentId)?.user;
                  return <p className="font-semibold">{u?.fullName ?? u?.email}</p>;
                })()}
                <div
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium',
                    selectedSub.status === 'LATE'
                      ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
                      : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                  )}
                >
                  <CalendarCheck className="h-3.5 w-3.5" />
                  {selectedSub.status === 'LATE' ? 'Nộp trễ' : 'Đã nộp'} lúc{' '}
                  {formatDate(selectedSub.submittedAt)}
                </div>
              </div>
              {canManage && (
                <DeleteSubmissionButton
                  submissionId={selectedSub.id}
                  studentName={
                    enrollments.find((e) => e.userId === selectedStudentId)?.user.fullName ??
                    'học sinh'
                  }
                />
              )}
            </div>

            {/* Content */}
            {selectedSub.content && (
              <div className="border-border bg-background rounded-xl border p-4">
                <RichTextEditor
                  content={selectedSub.content}
                  editable={false}
                  className="border-0 bg-transparent"
                />
              </div>
            )}

            {/* Files */}
            {selectedSub.files.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">File đính kèm</p>
                {selectedSub.files.map((f) => (
                  <a
                    key={f.id}
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-border bg-muted/30 hover:bg-muted flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
                  >
                    {f.name}
                  </a>
                ))}
              </div>
            )}

            {/* Rubric grader (if rubric exists) */}
            {canManage && rubric && rubric.criteria.length > 0 && (
              <RubricGrader
                submissionId={selectedSub.id}
                maxScore={assignment.maxScore}
                rubric={rubric}
                initialGrades={rubricGrades}
              />
            )}

            {/* Manual grade form (always shown alongside or without rubric) */}
            {canManage && (
              <GradeForm
                submissionId={selectedSub.id}
                maxScore={assignment.maxScore}
                currentScore={selectedSub.score}
                currentFeedback={selectedSub.feedback ?? ''}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
