import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { getAssignmentAction, getSubmissionsAction } from '@/actions/assignments';
import { RichTextEditor } from '@/components/ui/editor/RichTextEditor';
import { GradeForm } from '@/components/features/assignments/GradeForm';
import { hasMinRole } from '@/lib/permissions';
import { ChevronLeft, CheckCircle2, Clock, Circle } from 'lucide-react';
import { prisma } from '@/lib/db';
import { cn } from '@/lib/utils';
import type { UserRole } from '@prisma/client';

export const metadata = { title: 'Bài nộp' };

function formatDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
}

export default async function SubmissionsPage({
  params,
  searchParams,
}: {
  params:       Promise<{ slug: string; assignmentId: string }>;
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

  const submissions = await getSubmissionsAction(assignmentId);

  // Load enrolled students
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: course.id, status: 'ACTIVE' },
    select: { userId: true, user: { select: { id: true, fullName: true, email: true } } },
    orderBy: { user: { fullName: 'asc' } },
  });

  const submissionMap = new Map(submissions.map((s) => [s.studentId, s]));

  const selectedSub = selectedStudentId ? submissionMap.get(selectedStudentId) ?? null : null;
  const canManage = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session?.user?.id);

  const submittedCount = submissions.filter((s) => s.status !== 'DRAFT').length;
  const gradedCount    = submissions.filter((s) => s.status === 'GRADED').length;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] max-w-7xl overflow-hidden -mx-6 -mb-6 -mt-6">
      {/* Left: student list */}
      <aside className="w-64 shrink-0 flex flex-col border-r border-border bg-card overflow-y-auto">
        <div className="border-b border-border px-4 py-3">
          <Link href={`/courses/${slug}/assignments/${assignmentId}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors">
            <ChevronLeft className="h-3.5 w-3.5" /> {assignment.title}
          </Link>
          <p className="text-xs text-muted-foreground">
            {submittedCount}/{enrollments.length} đã nộp · {gradedCount} đã chấm
          </p>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {enrollments.map(({ user }) => {
            const sub = submissionMap.get(user.id);
            const isSelected = selectedStudentId === user.id;
            return (
              <Link
                key={user.id}
                href={`/courses/${slug}/assignments/${assignmentId}/submissions?student=${user.id}`}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                )}
              >
                {sub?.status === 'GRADED' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                ) : sub && sub.status !== 'DRAFT' ? (
                  <Clock className="h-4 w-4 shrink-0 text-blue-500" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium leading-tight">{user.fullName ?? user.email}</p>
                  {sub?.score != null && (
                    <p className={cn('text-xs', isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                      {sub.score}/{assignment.maxScore}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Right: submission detail + grading */}
      <main className="flex-1 overflow-y-auto p-6">
        {!selectedStudentId ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <p>Chọn học sinh từ danh sách để xem bài nộp</p>
          </div>
        ) : !selectedSub || selectedSub.status === 'DRAFT' ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <p>Học sinh chưa nộp bài</p>
          </div>
        ) : (
          <div className="max-w-3xl space-y-6">
            {/* Submission meta */}
            <div className="flex items-center justify-between">
              <div>
                {(() => {
                  const u = enrollments.find((e) => e.userId === selectedStudentId)?.user;
                  return <p className="font-semibold">{u?.fullName ?? u?.email}</p>;
                })()}
                <p className="text-xs text-muted-foreground">
                  Nộp lúc {formatDate(selectedSub.submittedAt)}
                  {selectedSub.status === 'LATE' && <span className="ml-2 text-orange-500">(trễ)</span>}
                </p>
              </div>
            </div>

            {/* Content */}
            {selectedSub.content && (
              <div className="rounded-xl border border-border bg-background p-4">
                <RichTextEditor content={selectedSub.content} editable={false} className="border-0 bg-transparent" />
              </div>
            )}

            {/* Files */}
            {selectedSub.files.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">File đính kèm</p>
                {selectedSub.files.map((f) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm hover:bg-muted transition-colors">
                    {f.name}
                  </a>
                ))}
              </div>
            )}

            {/* Grade form */}
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
