import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { cookies, headers } from 'next/headers';
import { apiServerClient, orNotFound } from '@/lib/api-client';
import type { CourseDetail, CourseNavItem, QuizDetail, AttemptListItem } from '@lumibach/types';
import { buttonVariants } from '@/components/ui/button';
import { PageHero } from '@/components/layouts/PageHero';
import { DeleteQuizButton } from '@/components/features/quiz/DeleteQuizButton';
import { QuizStatusButton } from '@/components/features/quiz/QuizStatusButton';
import { QuizQuestionPoints } from '@/components/features/quiz/QuizQuestionPoints';
import { StartQuizButton } from '@/components/features/quiz/StartQuizButton';
import { SebLockScreen } from '@/components/features/seb/SebLockScreen';
import { isSafeExamBrowser, sebConfigPath, sebLaunchUrl } from '@/lib/seb';
import { ActivityCompetencyPanel } from '@/components/features/competencies/ActivityCompetencyPanel';
import { hasMinRole } from '@/lib/permissions';
import {
  Brain,
  Clock,
  Pencil,
  Calendar,
  RotateCcw,
  HelpCircle,
  Users,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  Target,
  Eye,
} from 'lucide-react';
import { cn, stripHtml } from '@/lib/utils';
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
  params: Promise<{ slug: string; quizId: string }>;
}) {
  const { quizId } = await params;
  const api = apiServerClient(await cookies());
  const quiz = await api.get<QuizDetail>(`/quizzes/${quizId}`).catch(() => null);
  return { title: quiz?.title ?? 'Quiz' };
}

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground border-border',
  PUBLISHED:
    'border-emerald-600/25 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
  CLOSED: 'bg-destructive/10 text-destructive border-destructive/20',
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  PUBLISHED: 'Đã đăng',
  CLOSED: 'Đã đóng',
};
const TYPE_BADGE: Record<string, string> = {
  MULTIPLE_CHOICE_SINGLE: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  MULTIPLE_CHOICE_MULTIPLE: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  TRUE_FALSE: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  TRUE_FALSE_MULTI: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  ESSAY: 'bg-green-500/10 text-green-700 dark:text-green-400',
  CODE_PYTHON: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
  CODE_CPP: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  CODE_WEB: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  PARSONS: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400',
  CODE_FILL: 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  CODE_DEBUG_PYTHON: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  CODE_DEBUG_CPP: 'bg-pink-500/10 text-pink-700 dark:text-pink-400',
};
const TYPE_SHORT: Record<string, string> = {
  MULTIPLE_CHOICE_SINGLE: 'TN-1',
  MULTIPLE_CHOICE_MULTIPLE: 'TN-N',
  TRUE_FALSE: 'Đ/S',
  TRUE_FALSE_MULTI: 'Đ/S+',
  ESSAY: 'TL',
  CODE_PYTHON: 'PY',
  CODE_CPP: 'C++',
  CODE_WEB: 'Web',
  PARSONS: 'Sắp',
  CODE_FILL: 'Điền',
  CODE_DEBUG_PYTHON: 'Debug-PY',
  CODE_DEBUG_CPP: 'Debug-C++',
};

function fmt(d: string | Date | null | undefined) {
  return formatDateTime(d);
}

export default async function QuizDetailPage({
  params,
}: {
  params: Promise<{ slug: string; quizId: string }>;
}) {
  const { slug, quizId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  const api = apiServerClient(await cookies());
  const course = await orNotFound(api.get<CourseDetail>(`/courses/${slug}`));
  if (!course) notFound();

  const quiz = await orNotFound(api.get<QuizDetail>(`/quizzes/${quizId}`));
  if (!quiz) notFound();

  const isStaff = role ? hasMinRole(role, 'TA') : false;
  const canManage = course.viewerCanManage;

  if (!isStaff && quiz.status !== 'PUBLISHED') notFound();

  const [myAttempts, allNavItems] = await Promise.all([
    !isStaff
      ? api
          .get<AttemptListItem[]>('/attempts/mine', { query: { quizId } })
          .catch(() => [] as AttemptListItem[])
      : Promise.resolve([] as AttemptListItem[]),
    api
      .get<
        CourseNavItem[]
      >('/modules/nav', { query: { courseId: course.id, publishedOnly: !isStaff } })
      .catch(() => [] as CourseNavItem[]),
  ]);
  const reqHeaders = await headers();
  const isSeb = isSafeExamBrowser(reqHeaders);
  const sebBlocked = !isStaff && quiz.sebEnabled && !isSeb;
  const sebLaunch = sebLaunchUrl(reqHeaders, 'quiz', quizId);

  const currentNavIndex = allNavItems.findIndex((i) => i.quizId === quizId);
  const prevNavItem = currentNavIndex > 0 ? (allNavItems[currentNavIndex - 1] ?? null) : null;
  const nextNavItem =
    currentNavIndex < allNavItems.length - 1 ? (allNavItems[currentNavIndex + 1] ?? null) : null;
  const totalPoints = quiz.questions.reduce((s, qq) => s + (qq.points ?? qq.question.points), 0);

  return (
    <div className="w-full space-y-8 pb-12">
      {/* ── Page header ────────────────────────────────── */}
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
              <Brain className="text-primary h-4 w-4" />
              <p className="text-primary text-sm font-semibold">Bài Trắc nghiệm</p>
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight break-words sm:text-3xl">
              {quiz.title}
            </h1>
            {quiz.description && (
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{quiz.description}</p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {canManage && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                    STATUS_CLASS[quiz.status]
                  )}
                >
                  {STATUS_LABEL[quiz.status]}
                </span>
              )}
              {allNavItems.length > 1 && currentNavIndex >= 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-600/25 bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-800 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-400">
                  Mục {currentNavIndex + 1}/{allNavItems.length}
                </span>
              )}
              <span className="border-primary/20 bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                <HelpCircle className="h-3 w-3" /> {quiz.questions.length} câu hỏi
              </span>
              {totalPoints > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-600/25 bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-800 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-400">
                  <Target className="h-3 w-3" /> {totalPoints} điểm
                </span>
              )}
              {quiz.timeLimit && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-600/25 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                  <Clock className="h-3 w-3" /> {quiz.timeLimit} phút
                </span>
              )}
              {quiz.maxAttempts && (
                <span className="border-border bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                  <RotateCcw className="h-3 w-3" /> Tối đa {quiz.maxAttempts} lần
                </span>
              )}
              {quiz.dueDate && (
                <span className="border-destructive/20 bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                  <Calendar className="h-3 w-3" /> Hạn: {fmt(quiz.dueDate)}
                </span>
              )}
            </div>
          </div>

          {canManage && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <QuizStatusButton quizId={quizId} isPublished={quiz.status === 'PUBLISHED'} />
              <Link
                href={`/courses/${slug}/quizzes/${quizId}/manage`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <ListChecks className="text-muted-foreground mr-1 h-3.5 w-3.5" /> Câu hỏi
              </Link>
              <Link
                href={`/courses/${slug}/quizzes/${quizId}/edit`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <Pencil className="text-muted-foreground mr-1 h-3.5 w-3.5" /> Cài đặt
              </Link>
              <Link
                href={`/courses/${slug}/quizzes/${quizId}/attempts`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <Users className="text-muted-foreground mr-1 h-3.5 w-3.5" /> Bài làm
              </Link>
              <DeleteQuizButton quizId={quizId} courseSlug={slug} />
            </div>
          )}
        </div>
      </PageHero>

      <div className="space-y-8">
        {/* ── Student: start CTA + history ───────────────────── */}
        {!isStaff && sebBlocked && (
          <SebLockScreen
            title={quiz.title}
            launchUrl={sebLaunch}
            downloadUrl={sebConfigPath('quiz', quizId)}
          />
        )}

        {!isStaff && !sebBlocked && (
          <div className="space-y-6">
            <div className="border-border bg-card flex flex-col items-center justify-center gap-5 rounded-xl border px-4 py-10 text-center shadow-sm sm:py-12">
              <div>
                <div className="bg-primary/10 text-primary mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg">
                  <Brain className="h-8 w-8" />
                </div>
                <h2 className="text-lg font-bold break-words sm:text-xl">{quiz.title}</h2>
                <div className="text-muted-foreground mt-3 flex flex-wrap items-center justify-center gap-3 text-sm font-medium">
                  <span>{quiz.questions.length} câu hỏi</span>
                  {quiz.timeLimit && <span>· {quiz.timeLimit} phút</span>}
                  {quiz.maxAttempts && (
                    <span>
                      · Đã làm {myAttempts.filter((a) => a.status !== 'IN_PROGRESS').length}/
                      {quiz.maxAttempts} lần
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2">
                {quiz.questions.length > 0 ? (
                  <StartQuizButton quizId={quizId} courseSlug={slug} />
                ) : (
                  <p className="text-muted-foreground text-sm italic">Quiz chưa có câu hỏi.</p>
                )}
              </div>
            </div>

            {myAttempts.length > 0 && (
              <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
                <div className="border-border bg-muted/40 flex items-center gap-2 border-b px-4 py-4 sm:px-6">
                  <RotateCcw className="text-primary h-5 w-5" />
                  <h2 className="text-lg font-bold">Lịch sử làm bài</h2>
                </div>
                <div className="p-4 sm:p-6">
                  <div className="space-y-3">
                    {myAttempts.map((a, i) => {
                      const pct =
                        a.maxScore && a.maxScore > 0
                          ? Math.round(((a.score ?? 0) / a.maxScore) * 100)
                          : null;
                      const AT_CLASS: Record<string, string> = {
                        IN_PROGRESS:
                          'border-blue-600/25 bg-blue-50 text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400',
                        SUBMITTED:
                          'border-amber-600/25 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400',
                        GRADED:
                          'border-emerald-600/25 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400',
                      };
                      const AT_LABEL: Record<string, string> = {
                        IN_PROGRESS: 'Đang làm',
                        SUBMITTED: 'Đã nộp',
                        GRADED: 'Đã chấm',
                      };
                      return (
                        <Link
                          key={a.id}
                          href={`/courses/${slug}/quizzes/${quizId}/attempt/${a.id}`}
                          className="border-border bg-card hover:bg-muted/40 group flex items-center gap-3 rounded-lg border px-4 py-4 transition-colors sm:gap-4 sm:px-5"
                        >
                          <div className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-colors">
                            #{myAttempts.length - i}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span
                                className={cn(
                                  'rounded-full border px-2 py-0.5 text-xs font-semibold',
                                  AT_CLASS[a.status] ?? ''
                                )}
                              >
                                {AT_LABEL[a.status] ?? a.status}
                              </span>
                            </div>
                            {a.submittedAt ? (
                              <p className="text-muted-foreground text-xs font-medium">
                                Nộp lúc: {fmt(a.submittedAt)}
                              </p>
                            ) : (
                              <p className="text-muted-foreground text-xs font-medium">
                                Chưa nộp bài
                              </p>
                            )}
                          </div>

                          {a.score != null && (
                            <div className="shrink-0 text-right">
                              <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold">{a.score}</span>
                                <span className="text-muted-foreground text-sm font-semibold">
                                  /{a.maxScore}
                                </span>
                              </div>
                              {pct != null && (
                                <p className="text-primary mt-0.5 text-xs font-bold">{pct}%</p>
                              )}
                            </div>
                          )}

                          <ChevronRight className="text-muted-foreground/40 group-hover:text-primary hidden h-5 w-5 transition-colors sm:ml-2 sm:block" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Teacher / TA: question preview list ────────────── */}
        {isStaff && (
          <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
            <div className="border-border bg-muted/40 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-4 sm:px-6">
              <div className="flex items-center gap-2">
                <ListChecks className="text-primary h-5 w-5" />
                <h2 className="text-lg font-bold">
                  Danh sách câu hỏi{' '}
                  <span className="text-muted-foreground ml-1 font-normal">
                    ({quiz.questions.length})
                  </span>
                </h2>
              </div>
              {canManage && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Link
                    href={`/courses/${slug}/quizzes/${quizId}/preview`}
                    className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
                  >
                    <Eye className="h-4 w-4" /> Xem thử
                  </Link>
                  <Link
                    href={`/courses/${slug}/quizzes/${quizId}/manage`}
                    className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
                  >
                    <ListChecks className="h-4 w-4" /> Thêm / Xoá câu hỏi
                  </Link>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6">
              {quiz.questions.length === 0 ? (
                <div className="border-border bg-muted/20 flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center">
                  <HelpCircle className="text-muted-foreground/40 h-12 w-12" />
                  <p className="text-muted-foreground text-sm font-medium">
                    Chưa có câu hỏi nào trong quiz.
                  </p>
                  {canManage && (
                    <Link
                      href={`/courses/${slug}/quizzes/${quizId}/manage`}
                      className={buttonVariants()}
                    >
                      <ListChecks className="mr-2 h-4 w-4" /> Thêm câu hỏi ngay
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {quiz.questions.map((qq, idx) => (
                    <div
                      key={qq.questionId}
                      className="border-border bg-card hover:bg-muted/40 flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors sm:gap-4 sm:px-5 sm:py-4"
                    >
                      <div className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                        {idx + 1}
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                          TYPE_BADGE[qq.question.type] ?? ''
                        )}
                      >
                        {TYPE_SHORT[qq.question.type] ?? qq.question.type}
                      </span>
                      <p className="line-clamp-2 min-w-0 flex-1 text-sm font-medium">
                        {stripHtml(qq.question.content)}
                      </p>
                      {canManage ? (
                        <QuizQuestionPoints
                          quizQuestionId={qq.id}
                          initialPoints={qq.points ?? qq.question.points}
                        />
                      ) : (
                        <span className="text-muted-foreground bg-muted shrink-0 rounded-lg px-2 py-1 text-sm font-bold">
                          {qq.points ?? qq.question.points}đ
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Competency assessment — staff only */}
        {isStaff && (
          <ActivityCompetencyPanel
            courseId={course.id}
            courseSlug={slug}
            activityType="quiz"
            activityId={quizId}
            canManage={canManage}
          />
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
