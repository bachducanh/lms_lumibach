import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { apiServerClient, orNotFound } from '@/lib/api-client';
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
import { PageHero } from '@/components/layouts/PageHero';
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
import { formatDateTime } from '@/lib/datetime';

function navItemUrl(item: CourseNavItem, slug: string): string {
  if (item.type === 'LESSON' && item.lessonId) return `/courses/${slug}/lessons/${item.lessonId}`;
  if (item.type === 'ASSIGNMENT' && item.assignmentId)
    return `/courses/${slug}/assignments/${item.assignmentId}`;
  if (item.type === 'QUIZ' && item.quizId) return `/courses/${slug}/quizzes/${item.quizId}`;
  if (item.type === 'PRACTICE_TEST' && item.practiceTestId)
    return `/courses/${slug}/practice-tests/${item.practiceTestId}`;
  if (item.type === 'FORUM' && item.forumId)
    return `/courses/${slug}/forum?forumId=${item.forumId}`;
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
  SUBMITTED:
    'border-blue-600/25 bg-blue-50 text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400',
  LATE: 'border-amber-600/25 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400',
  GRADED:
    'border-emerald-600/25 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400',
  RETURNED:
    'border-purple-600/25 bg-purple-50 text-purple-800 dark:border-purple-500/20 dark:bg-purple-500/10 dark:text-purple-400',
};

function formatDate(d: string | Date | null | undefined) {
  return formatDateTime(d);
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
  const course = await orNotFound(api.get<CourseDetail>(`/courses/${slug}`));
  if (!course) notFound();

  const assignment = await orNotFound(api.get<AssignmentDetail>(`/assignments/${assignmentId}`));
  if (!assignment) notFound();
  if (assignment.courseId !== course.id) notFound();

  const canManage = course.viewerCanManage;
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
    <div className="w-full space-y-8 pb-12">
      {/* ── Page hero header ────────────────────────────────── */}
      <PageHero
        footer={
          allNavItems.length > 1 && currentNavIndex >= 0 ? (
            <div className="bg-muted h-1">
              <div
                className="bg-primary h-full transition-all duration-500"
                style={{ width: `${((currentNavIndex + 1) / allNavItems.length) * 100}%` }}
              />
            </div>
          ) : null
        }
      >
        <Link
          href={`/courses/${slug}/modules`}
          className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Nội dung khoá học
        </Link>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <ClipboardList className="text-primary h-4 w-4" />
              <p className="text-primary text-sm font-semibold">Bài tập</p>
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight break-words sm:text-3xl">
              {assignment.title}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="border-primary/20 bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                <Target className="h-3 w-3" /> {TYPE_LABEL[assignment.type]}
              </span>
              {allNavItems.length > 1 && currentNavIndex >= 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-600/25 bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-400">
                  Mục {currentNavIndex + 1}/{allNavItems.length}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-600/25 bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-400">
                <CheckCircle2 className="h-3 w-3" /> {assignment.maxScore} điểm
              </span>
              {assignment.dueDate && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                    isPastDue
                      ? 'border-destructive/30 bg-destructive/10 text-destructive'
                      : 'border-amber-600/25 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400'
                  )}
                >
                  <Clock className="h-3 w-3" /> Hạn nộp: {formatDate(assignment.dueDate)}
                </span>
              )}
              {assignment.availableFrom && !isAvailable && (
                <span className="border-muted-foreground/20 bg-muted/30 text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                  <CalendarDays className="h-3 w-3" /> Mở từ {formatDate(assignment.availableFrom)}
                </span>
              )}
              {mySubmission && role === 'STUDENT' && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                    STATUS_CLASS[mySubmission.status]
                  )}
                >
                  {STATUS_LABEL[mySubmission.status] ?? mySubmission.status}
                </span>
              )}
            </div>
          </div>

          {canManage && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
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
      </PageHero>

      <div className="space-y-8">
        {/* Code Assignment Setup — teacher/TA only */}
        {isCodeAssignment && isStaff && (
          <div className="border-primary/20 bg-primary/5 relative overflow-hidden rounded-xl border shadow-sm">
            <div className="bg-primary absolute top-0 bottom-0 left-0 w-1" />
            <div className="p-4 sm:p-6">
              <CodeAssignmentSetup assignmentId={assignmentId} existing={codeAssignment} />
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
          <div className="border-border bg-muted/40 flex items-center gap-2 border-b px-4 py-4 sm:px-6">
            <FileText className="text-primary h-5 w-5" />
            <h2 className="text-lg font-bold">Nội dung bài tập</h2>
          </div>
          <div className="p-4 sm:p-6 md:p-8">
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
          <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
            <div className="border-border bg-muted/40 flex items-center gap-2 border-b px-4 py-4 sm:px-6">
              <Target className="text-primary h-5 w-5" />
              <h2 className="text-lg font-bold">Tiêu chí chấm điểm (Rubric)</h2>
            </div>
            <div className="p-4 sm:p-6">
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
          <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
            <div className="border-border bg-muted/40 flex items-center gap-2 border-b px-4 py-4 sm:px-6">
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
          <div className="border-border bg-card rounded-xl border border-dashed p-8 text-center sm:p-10">
            <p className="text-muted-foreground text-sm font-medium">
              Giáo viên chưa cấu hình môi trường cho bài tập code này.
            </p>
          </div>
        )}

        {/* TEXT/FILE/BOTH student submission section */}
        {role === 'STUDENT' && !isCodeAssignment && (
          <div className="border-border bg-card relative overflow-hidden rounded-xl border shadow-sm">
            <div className="border-border bg-muted/40 flex flex-wrap items-center justify-between gap-4 border-b px-4 py-4 sm:px-6">
              <div className="flex items-center gap-2">
                <Download className="text-primary h-5 w-5" />
                <h2 className="text-lg font-bold">Khu vực nộp bài</h2>
              </div>
              {mySubmission && (
                <span
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-semibold',
                    STATUS_CLASS[mySubmission.status] ??
                      'border-border bg-muted text-muted-foreground'
                  )}
                >
                  {STATUS_LABEL[mySubmission.status] ?? mySubmission.status}
                </span>
              )}
            </div>

            <div className="space-y-6 p-4 sm:p-6 md:p-8">
              {/* Submission receipt — shown for SUBMITTED / LATE */}
              {mySubmission &&
                (mySubmission.status === 'SUBMITTED' || mySubmission.status === 'LATE') && (
                  <div
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-4 py-3 sm:px-5 sm:py-4',
                      mySubmission.status === 'LATE'
                        ? 'border-amber-600/25 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-400'
                        : 'border-emerald-600/25 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-400'
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
                  <div className="border-primary/20 bg-primary/5 relative space-y-4 overflow-hidden rounded-xl border p-4 sm:p-6">
                    <div className="border-primary/10 relative z-10 flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
                      <div>
                        <h3 className="text-primary text-sm font-bold">Kết quả đánh giá</h3>
                        <p className="text-muted-foreground mt-1 text-xs">
                          Đã chấm lúc {formatDate(mySubmission.submittedAt)}
                        </p>
                      </div>
                      <div className="bg-background border-border flex items-baseline gap-1 rounded-lg border px-4 py-2 shadow-sm">
                        <span className="text-foreground text-3xl font-bold">
                          {mySubmission.score}
                        </span>
                        <span className="text-muted-foreground text-sm font-bold">
                          /{assignment.maxScore}
                        </span>
                      </div>
                    </div>

                    {mySubmission.feedback && (
                      <div className="relative z-10">
                        <p className="text-muted-foreground mb-2 text-xs font-semibold">
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
                <div className="border-border bg-muted/30 rounded-xl border border-dashed p-6 text-center sm:p-8">
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
                    <p className="text-muted-foreground mb-0.5 text-xs font-semibold">Bài trước</p>
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
                    <p className="text-muted-foreground mb-0.5 text-xs font-semibold">
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
