import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type {
  CourseDetail,
  CourseNavItem,
  AssignmentDetail,
  SubmissionItem,
  RubricData,
  CodeExerciseDetail,
} from '@lumibach/types';
import { RubricView } from '@/components/features/assignments/RubricView';
import { RichTextEditor } from '@/components/ui/editor/RichTextEditor';
import { buttonVariants } from '@/components/ui/button';
import { SubmissionForm } from '@/components/features/assignments/SubmissionForm';
import { SubmissionFiles } from '@/components/features/assignments/SubmissionFiles';
import { CodeSubmitPanel } from '@/components/features/code/CodeSubmitPanel';
import { CodeAssignmentSetup } from '@/components/features/code/CodeAssignmentSetup';
import { ActivityCompetencyPanel } from '@/components/features/competencies/ActivityCompetencyPanel';
import { GroupSubmissionPanel } from '@/components/features/assignments/GroupSubmissionPanel';
import { hasMinRole } from '@/lib/permissions';
import {
  Clock,
  Pencil,
  Users,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Target,
  CalendarDays,
  FileText,
  Download,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@lumibach/db';

function navItemUrl(item: CourseNavItem, slug: string): string {
  if (item.type === 'LESSON' && item.lessonId) return `/courses/${slug}/lessons/${item.lessonId}`;
  if (item.type === 'ASSIGNMENT' && item.assignmentId)
    return `/courses/${slug}/assignments/${item.assignmentId}`;
  if (item.type === 'QUIZ' && item.quizId) return `/courses/${slug}/quizzes/${item.quizId}`;
  if (item.type === 'PRACTICE_TEST' && item.practiceTestId)
    return `/courses/${slug}/practice-tests/${item.practiceTestId}`;
  if (item.type === 'CODE_EXERCISE' && item.codeExerciseId) {
    return item.codeExercise?.language === 'SCRATCH'
      ? `/courses/${slug}/scratch/${item.codeExerciseId}`
      : `/courses/${slug}/exercises/${item.codeExerciseId}`;
  }
  return `/courses/${slug}/modules`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const api = apiServerClient(await cookies());
  const a = await api.get<AssignmentDetail>(`/assignments/${assignmentId}`).catch(() => null);
  return { title: a?.title ?? 'Bài tập' };
}

const TYPE_LABEL: Record<string, string> = {
  TEXT: 'Văn bản',
  FILE: 'File',
  BOTH: 'Văn bản + File',
  CODE: 'Lập trình',
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã nộp',
  LATE: 'Nộp trễ',
  GRADED: 'Đã chấm',
  RETURNED: 'Đã trả',
};
const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground border-border',
  SUBMITTED: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  LATE: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  GRADED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  RETURNED: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

function formatDate(d: string | Date | null | undefined) {
  if (!d) return null;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));
}

export default async function AssignmentViewPage({
  params,
}: {
  params: Promise<{ slug: string; assignmentId: string }>;
}) {
  const { slug, assignmentId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  const userId = session?.user?.id;

  if (!role || !userId) redirect('/login');

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  const assignment = await api
    .get<AssignmentDetail>(`/assignments/${assignmentId}`)
    .catch(() => null);
  if (!assignment) notFound();
  if (assignment.courseId !== course.id) notFound();

  const canManage = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === userId);
  const isStaff = hasMinRole(role, 'TA');

  if (assignment.status === 'DRAFT' && !isStaff) notFound();

  const isCodeAssignment = (assignment.type as string) === 'CODE';

  const [mySubmission, rubric, allNavItems, codeAssignment, myCodeSubs] = await Promise.all([
    role === 'STUDENT' && !isCodeAssignment
      ? api
          .get<SubmissionItem[]>(`/assignments/${assignmentId}/my-submissions`)
          .then((s) => s[0] ?? null)
          .catch(() => null)
      : Promise.resolve(null),
    api.get<RubricData>(`/rubrics/assignment/${assignmentId}`).catch(() => null),
    api
      .get<
        CourseNavItem[]
      >('/modules/nav', { query: { courseId: course.id, publishedOnly: !isStaff } })
      .catch(() => [] as CourseNavItem[]),
    Promise.resolve(null) as Promise<CodeExerciseDetail | null>,
    role === 'STUDENT' && isCodeAssignment ? Promise.resolve([]) : Promise.resolve([]),
  ]);
  const currentNavIndex = allNavItems.findIndex((item) => item.assignmentId === assignmentId);
  const prevNavItem = currentNavIndex > 0 ? (allNavItems[currentNavIndex - 1] ?? null) : null;
  const nextNavItem =
    currentNavIndex < allNavItems.length - 1 ? (allNavItems[currentNavIndex + 1] ?? null) : null;

  const now = new Date();
  const isAvailable = !assignment.availableFrom || now >= new Date(assignment.availableFrom);
  const isPastDue = assignment.dueDate ? now > new Date(assignment.dueDate) : false;
  const isPastLate = assignment.lateDeadline ? now > new Date(assignment.lateDeadline) : false;
  const withinDeadline =
    isAvailable &&
    !(isPastDue && assignment.latePolicy === 'NONE' && (!assignment.lateDeadline || isPastLate));

  const hasEditableSubmission = !!mySubmission && mySubmission.status !== 'GRADED';
  const canSubmit =
    role === 'STUDENT' &&
    assignment.status === 'PUBLISHED' &&
    (hasEditableSubmission || withinDeadline);

  return (
    <div className="space-y-8">
      {/* ── Page hero header ────────────────────────────────── */}
      <div className="border-border bg-card relative -mx-6 -mt-6 overflow-hidden border-b">
        {/* Tech grid */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.03]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="assignment-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#assignment-grid)" />
        </svg>

        {/* Glow accents */}
        <div
          className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl"
          style={{ background: 'rgb(59 130 246 / 10%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-10 left-1/3 h-32 w-64 rounded-full blur-3xl"
          style={{ background: 'oklch(0.80 0.13 210 / 0.06)' }}
        />

        {/* Top accent line */}
        <div
          className="absolute top-0 right-0 left-0 h-[2px]"
          style={{
            background: 'linear-gradient(90deg, transparent, rgb(59 130 246 / 60%), transparent)',
          }}
        />

        <div className="relative px-6 py-8">
          <Link
            href={`/courses/${slug}/modules`}
            className="text-muted-foreground hover:text-primary mb-4 inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase transition-colors duration-150"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Nội dung khoá học
          </Link>

          <div className="flex items-end justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <ClipboardList
                  className="h-3.5 w-3.5 text-blue-500"
                  style={{ filter: 'drop-shadow(0 0 6px #3b82f6)' }}
                />
                <p className="text-[11px] font-bold tracking-[0.2em] text-blue-500 uppercase">
                  Bài tập
                </p>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{assignment.title}</h1>

              <div className="mt-2 flex items-center gap-2">
                <span className="border-primary/20 bg-primary/10 text-primary inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-xs font-semibold tracking-wide">
                  <Target className="h-3 w-3" /> {TYPE_LABEL[assignment.type]}
                </span>
                {allNavItems.length > 1 && currentNavIndex >= 0 && (
                  <span className="inline-flex items-center gap-1 rounded border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-cyan-400">
                    Mục {currentNavIndex + 1}/{allNavItems.length}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-cyan-400">
                  <CheckCircle2 className="h-3 w-3" /> {assignment.maxScore} điểm
                </span>
                {assignment.dueDate && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-xs font-semibold tracking-wide',
                      isPastDue
                        ? 'border-destructive/30 bg-destructive/10 text-destructive'
                        : 'border-amber-500/20 bg-amber-500/10 text-amber-500'
                    )}
                  >
                    <Clock className="h-3 w-3" /> Hạn nộp: {formatDate(assignment.dueDate)}
                  </span>
                )}
                {assignment.availableFrom && !isAvailable && (
                  <span className="border-muted-foreground/20 bg-muted/30 text-muted-foreground inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-xs font-semibold tracking-wide">
                    <CalendarDays className="h-3 w-3" /> Mở từ{' '}
                    {formatDate(assignment.availableFrom)}
                  </span>
                )}
                {mySubmission && role === 'STUDENT' && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-xs font-semibold tracking-wide',
                      STATUS_CLASS[mySubmission.status]
                    )}
                  >
                    {STATUS_LABEL[mySubmission.status] ?? mySubmission.status}
                  </span>
                )}
              </div>
            </div>

            {canManage && (
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/courses/${slug}/assignments/${assignmentId}/submissions`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <Users className="text-muted-foreground mr-1 h-3.5 w-3.5" />{' '}
                  {assignment._count.submissions} Bài nộp
                </Link>
                <Link
                  href={`/courses/${slug}/assignments/${assignmentId}/edit`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <Pencil className="text-muted-foreground mr-1 h-3.5 w-3.5" /> Chỉnh sửa
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar — position in course */}
        {allNavItems.length > 1 && currentNavIndex >= 0 && (
          <div className="bg-muted h-1">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${((currentNavIndex + 1) / allNavItems.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-4xl space-y-8 pb-12">
        {/* Code Assignment Setup — teacher/TA only */}
        {isCodeAssignment && isStaff && (
          <div className="border-primary/20 bg-primary/5 relative overflow-hidden rounded-2xl border shadow-sm">
            <div className="bg-primary absolute top-0 bottom-0 left-0 w-1" />
            <div className="p-6">
              <CodeAssignmentSetup assignmentId={assignmentId} existing={codeAssignment} />
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="border-border/60 bg-card/40 hover:border-border/80 overflow-hidden rounded-2xl border shadow-lg backdrop-blur-md transition-all duration-300">
          <div className="border-border/50 bg-muted/20 flex items-center gap-2 border-b px-6 py-4">
            <FileText className="text-primary h-5 w-5" />
            <h2 className="text-lg font-bold">Nội dung bài tập</h2>
          </div>
          <div className="p-6 md:p-8">
            {assignment.instructions ? (
              <div className="prose prose-invert max-w-none">
                <RichTextEditor
                  content={assignment.instructions}
                  editable={false}
                  className="border-0 bg-transparent p-0"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center opacity-50">
                <FileText className="mb-3 h-10 w-10" />
                <p className="text-sm italic">Không có mô tả chi tiết.</p>
              </div>
            )}
          </div>
        </div>

        {/* Rubric — visible to all */}
        {rubric && rubric.criteria.length > 0 && (
          <div className="border-border/60 bg-card/40 overflow-hidden rounded-2xl border shadow-lg backdrop-blur-md">
            <div className="border-border/50 bg-muted/20 flex items-center gap-2 border-b px-6 py-4">
              <Target className="text-primary h-5 w-5" />
              <h2 className="text-lg font-bold">Tiêu chí chấm điểm (Rubric)</h2>
            </div>
            <div className="p-6">
              <RubricView rubric={rubric} />
            </div>
          </div>
        )}

        {/* Group submission settings — manager only, non-code assignments */}
        {canManage && !isCodeAssignment && (
          <GroupSubmissionPanel
            assignmentId={assignmentId}
            courseId={course.id}
            initialEnabled={assignment.groupSubmission}
            initialGroupingId={assignment.groupingId}
          />
        )}

        {/* Competency assessment — staff only */}
        {isStaff && (
          <ActivityCompetencyPanel
            courseId={course.id}
            courseSlug={slug}
            activityType="assignment"
            activityId={assignmentId}
            canManage={canManage}
          />
        )}

        {/* CODE type: student submission via Monaco */}
        {role === 'STUDENT' && isCodeAssignment && codeAssignment && (
          <div className="border-border/60 bg-card/40 overflow-hidden rounded-2xl border shadow-lg backdrop-blur-md">
            <div className="border-border/50 bg-muted/20 flex items-center gap-2 border-b px-6 py-4">
              <Terminal className="text-primary h-5 w-5" />
              <h2 className="text-lg font-bold">Môi trường lập trình</h2>
            </div>
            <div className="p-0">
              <CodeSubmitPanel
                assignmentId={assignmentId}
                language={codeAssignment.language}
                starterCode={codeAssignment.starterCode ?? ''}
                initialSubs={myCodeSubs}
              />
            </div>
          </div>
        )}

        {role === 'STUDENT' && isCodeAssignment && !codeAssignment && (
          <div className="border-border bg-card/30 rounded-2xl border border-dashed p-10 text-center shadow-sm">
            <p className="text-muted-foreground text-sm font-medium">
              Giáo viên chưa cấu hình môi trường cho bài tập code này.
            </p>
          </div>
        )}

        {/* TEXT/FILE/BOTH student submission section */}
        {role === 'STUDENT' && !isCodeAssignment && (
          <div className="border-border/60 bg-card/40 relative overflow-hidden rounded-2xl border shadow-lg backdrop-blur-md">
            {/* Glow accent */}
            <div className="via-primary/50 absolute top-0 left-1/4 h-[1px] w-1/2 bg-gradient-to-r from-transparent to-transparent" />

            <div className="border-border/50 bg-muted/20 flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4">
              <div className="flex items-center gap-2">
                <Download className="text-primary h-5 w-5" />
                <h2 className="text-lg font-bold">Khu vực nộp bài</h2>
              </div>
              {mySubmission && (
                <span
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-bold tracking-wider uppercase',
                    STATUS_CLASS[mySubmission.status] ??
                      'border-border bg-muted text-muted-foreground'
                  )}
                >
                  {STATUS_LABEL[mySubmission.status] ?? mySubmission.status}
                </span>
              )}
            </div>

            <div className="space-y-6 p-6 md:p-8">
              {/* Submission receipt — shown for SUBMITTED / LATE */}
              {mySubmission &&
                (mySubmission.status === 'SUBMITTED' || mySubmission.status === 'LATE') && (
                  <div
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-5 py-4 shadow-sm',
                      mySubmission.status === 'LATE'
                        ? 'border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400'
                        : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    {mySubmission.status === 'LATE' ? (
                      <AlertCircle className="h-5 w-5 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 shrink-0" />
                    )}
                    <p className="text-sm">
                      {mySubmission.status === 'LATE'
                        ? 'Bạn đã nộp bài trễ hạn vào lúc'
                        : 'Bạn đã nộp bài thành công vào lúc'}{' '}
                      <span className="font-bold">{formatDate(mySubmission.submittedAt)}</span>
                    </p>
                  </div>
                )}

              {/* GRADED: show score + feedback + read-only content */}
              {mySubmission?.status === 'GRADED' && (
                <div className="space-y-6">
                  <div className="border-primary/20 bg-primary/5 relative space-y-4 overflow-hidden rounded-xl border p-6">
                    <div className="absolute top-0 right-0 translate-x-1/4 -translate-y-1/4 transform opacity-10">
                      <Target className="h-48 w-48" />
                    </div>
                    <div className="border-primary/10 relative z-10 flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
                      <div>
                        <h3 className="text-primary text-sm font-bold tracking-wider uppercase">
                          Kết quả đánh giá
                        </h3>
                        <p className="text-muted-foreground mt-1 text-xs">
                          Đã chấm lúc {formatDate(mySubmission.submittedAt)}
                        </p>
                      </div>
                      <div className="bg-background border-border flex items-baseline gap-1 rounded-xl border px-4 py-2 shadow-sm">
                        <span className="text-foreground text-3xl font-black">
                          {mySubmission.score}
                        </span>
                        <span className="text-muted-foreground text-sm font-bold">
                          /{assignment.maxScore}
                        </span>
                      </div>
                    </div>

                    {mySubmission.feedback && (
                      <div className="relative z-10">
                        <p className="text-muted-foreground mb-2 text-xs font-bold tracking-wider uppercase">
                          Nhận xét từ giáo viên
                        </p>
                        <div className="prose prose-invert max-w-none text-sm">
                          <RichTextEditor
                            content={mySubmission.feedback}
                            editable={false}
                            className="border-0 bg-transparent p-0"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="border-border border-b pb-2 text-sm font-bold">
                      Bài làm đã nộp
                    </h3>
                    {mySubmission.content && (
                      <div className="bg-muted/30 prose prose-invert max-w-none rounded-xl p-4 text-sm">
                        <RichTextEditor
                          content={mySubmission.content}
                          editable={false}
                          className="border-0 bg-transparent p-0"
                        />
                      </div>
                    )}
                    {mySubmission.files.length > 0 && (
                      <SubmissionFiles files={mySubmission.files} />
                    )}
                  </div>
                </div>
              )}

              {/* Editable: DRAFT, SUBMITTED, LATE, or no submission yet */}
              {canSubmit && (
                <div className="pt-2">
                  <SubmissionForm
                    assignmentId={assignmentId}
                    assignmentType={assignment.type}
                    initialContent={mySubmission?.content ?? ''}
                    initialFiles={mySubmission?.files ?? []}
                    maxFiles={assignment.maxFiles}
                    maxFileSizeMb={assignment.maxFileSizeMb}
                    isEdit={hasEditableSubmission && mySubmission?.status !== 'DRAFT'}
                  />
                </div>
              )}

              {/* Can't submit, no submission */}
              {!canSubmit && !mySubmission && (
                <div className="border-border bg-muted/30 rounded-xl border border-dashed p-8 text-center">
                  <Clock className="text-muted-foreground/50 mx-auto mb-3 h-8 w-8" />
                  <p className="text-foreground text-sm font-medium">
                    {!isAvailable
                      ? `Bài tập chưa mở (sẽ mở từ ${formatDate(assignment.availableFrom)})`
                      : 'Đã hết hạn nộp bài.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Prev / Next navigation */}
        {(prevNavItem || nextNavItem) && (
          <div className="border-border grid grid-cols-2 gap-4 border-t pt-6">
            <div className="min-w-0">
              {prevNavItem ? (
                <Link
                  href={navItemUrl(prevNavItem, slug)}
                  className="hover:text-primary group inline-flex max-w-full items-center gap-2 transition-colors sm:gap-3"
                >
                  <ChevronLeft className="text-muted-foreground group-hover:text-primary h-5 w-5 shrink-0 transition-all group-hover:-translate-x-1" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground mb-0.5 text-[10px] font-bold tracking-wider uppercase">
                      Bài trước
                    </p>
                    <p className="max-w-[100px] truncate text-sm font-semibold sm:max-w-xs">
                      {prevNavItem.title}
                    </p>
                  </div>
                </Link>
              ) : (
                <Link
                  href={`/courses/${slug}/modules`}
                  className="text-muted-foreground hover:text-primary group inline-flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <ChevronLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-1" />
                  <span className="truncate">Về danh sách</span>
                </Link>
              )}
            </div>

            <div className="flex min-w-0 justify-end">
              {nextNavItem && (
                <Link
                  href={navItemUrl(nextNavItem, slug)}
                  className="hover:text-primary group inline-flex max-w-full flex-row-reverse items-center gap-2 text-right transition-colors sm:gap-3"
                >
                  <ChevronRight className="text-muted-foreground group-hover:text-primary h-5 w-5 shrink-0 transition-all group-hover:translate-x-1" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground mb-0.5 text-[10px] font-bold tracking-wider uppercase">
                      Bài tiếp theo
                    </p>
                    <p className="max-w-[100px] truncate text-sm font-semibold sm:max-w-xs">
                      {nextNavItem.title}
                    </p>
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
