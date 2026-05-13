import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail, CourseNavItem } from '@lumibach/types';
import { getQuizAction } from '@/actions/quizzes';
import { listMyAttemptsAction } from '@/actions/attempts';
import { buttonVariants } from '@/components/ui/button';
import { DeleteQuizButton } from '@/components/features/quiz/DeleteQuizButton';
import { QuizStatusButton } from '@/components/features/quiz/QuizStatusButton';
import { QuizQuestionPoints } from '@/components/features/quiz/QuizQuestionPoints';
import { StartQuizButton } from '@/components/features/quiz/StartQuizButton';
import { hasMinRole } from '@/lib/permissions';
import {
  Brain,
  Clock,
  Pencil,
  CheckCircle2,
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
import { cn } from '@/lib/utils';
import type { UserRole } from '@lumibach/db';

function navItemUrl(item: CourseNavItem, slug: string): string {
  if (item.type === 'LESSON' && item.lessonId) return `/courses/${slug}/lessons/${item.lessonId}`;
  if (item.type === 'ASSIGNMENT' && item.assignmentId)
    return `/courses/${slug}/assignments/${item.assignmentId}`;
  if (item.type === 'QUIZ' && item.quizId) return `/courses/${slug}/quizzes/${item.quizId}`;
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
  const quiz = await getQuizAction(quizId);
  return { title: quiz?.title ?? 'Quiz' };
}

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground border-border',
  PUBLISHED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  CLOSED: 'bg-destructive/10 text-destructive border-destructive/20',
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  PUBLISHED: 'Đã đăng',
  CLOSED: 'Đã đóng',
};
const TYPE_BADGE: Record<string, string> = {
  MULTIPLE_CHOICE_SINGLE: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  MULTIPLE_CHOICE_MULTIPLE: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  TRUE_FALSE: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  ESSAY: 'bg-green-500/10 text-green-500 border-green-500/20',
};
const TYPE_SHORT: Record<string, string> = {
  MULTIPLE_CHOICE_SINGLE: 'TN-1',
  MULTIPLE_CHOICE_MULTIPLE: 'TN-N',
  TRUE_FALSE: 'Đ/S',
  ESSAY: 'TL',
};

function fmt(d: Date | null | undefined) {
  if (!d) return null;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));
}

export default async function QuizDetailPage({
  params,
}: {
  params: Promise<{ slug: string; quizId: string }>;
}) {
  const { slug, quizId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  const userId = session?.user?.id;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();

  const quiz = await getQuizAction(quizId);
  if (!quiz) notFound();

  const isStaff = role ? hasMinRole(role, 'TA') : false;
  const canManage = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === userId);

  if (!isStaff && quiz.status !== 'PUBLISHED') notFound();

  const [myAttempts, allNavItems] = await Promise.all([
    !isStaff ? listMyAttemptsAction(quizId) : Promise.resolve([]),
    api
      .get<
        CourseNavItem[]
      >('/modules/nav', { query: { courseId: course.id, publishedOnly: !isStaff } })
      .catch(() => [] as CourseNavItem[]),
  ]);
  const currentNavIndex = allNavItems.findIndex((i) => i.quizId === quizId);
  const prevNavItem = currentNavIndex > 0 ? (allNavItems[currentNavIndex - 1] ?? null) : null;
  const nextNavItem =
    currentNavIndex < allNavItems.length - 1 ? (allNavItems[currentNavIndex + 1] ?? null) : null;
  const totalPoints = quiz.questions.reduce((s, qq) => s + (qq.points ?? qq.question.points), 0);

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
            <pattern id="quiz-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#quiz-grid)" />
        </svg>

        {/* Glow accents */}
        <div
          className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl"
          style={{ background: 'rgb(245 158 11 / 10%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-10 left-1/3 h-32 w-64 rounded-full blur-3xl"
          style={{ background: 'oklch(0.80 0.13 210 / 0.06)' }}
        />

        {/* Top accent line */}
        <div
          className="absolute top-0 right-0 left-0 h-[2px]"
          style={{
            background: 'linear-gradient(90deg, transparent, rgb(245 158 11 / 60%), transparent)',
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

          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Brain
                  className="h-3.5 w-3.5 text-amber-500"
                  style={{ filter: 'drop-shadow(0 0 6px #f59e0b)' }}
                />
                <p className="text-[11px] font-bold tracking-[0.2em] text-amber-500 uppercase">
                  Bài Trắc nghiệm
                </p>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{quiz.title}</h1>
              {quiz.description && (
                <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{quiz.description}</p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {canManage && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-xs font-semibold tracking-wide',
                      STATUS_CLASS[quiz.status]
                    )}
                  >
                    {STATUS_LABEL[quiz.status]}
                  </span>
                )}
                {allNavItems.length > 1 && currentNavIndex >= 0 && (
                  <span className="inline-flex items-center gap-1 rounded border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-cyan-400">
                    Mục {currentNavIndex + 1}/{allNavItems.length}
                  </span>
                )}
                <span className="border-primary/20 bg-primary/10 text-primary inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-xs font-semibold tracking-wide">
                  <HelpCircle className="h-3 w-3" /> {quiz.questions.length} câu hỏi
                </span>
                {totalPoints > 0 && (
                  <span className="inline-flex items-center gap-1 rounded border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-cyan-400">
                    <Target className="h-3 w-3" /> {totalPoints} điểm
                  </span>
                )}
                {quiz.timeLimit && (
                  <span className="inline-flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-amber-500">
                    <Clock className="h-3 w-3" /> {quiz.timeLimit} phút
                  </span>
                )}
                {quiz.maxAttempts && (
                  <span className="border-muted-foreground/20 bg-muted/30 text-muted-foreground inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-xs font-semibold tracking-wide">
                    <RotateCcw className="h-3 w-3" /> Tối đa {quiz.maxAttempts} lần
                  </span>
                )}
                {quiz.dueDate && (
                  <span className="border-destructive/20 bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-xs font-semibold tracking-wide">
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
        </div>

        {/* Progress bar — position in course */}
        {allNavItems.length > 1 && currentNavIndex >= 0 && (
          <div className="bg-muted h-1">
            <div
              className="h-full bg-amber-500 transition-all duration-500"
              style={{ width: `${((currentNavIndex + 1) / allNavItems.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-4xl space-y-8 pb-12">
        {/* ── Student: start CTA + history ───────────────────── */}
        {!isStaff && (
          <div className="space-y-6">
            <div className="relative flex flex-col items-center justify-center gap-5 overflow-hidden rounded-2xl border border-violet-500/20 bg-violet-500/5 py-12 text-center shadow-lg">
              <div className="absolute top-0 right-1/4 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
              <div className="bg-primary/10 absolute bottom-0 left-1/4 h-32 w-32 rounded-full blur-3xl" />

              <div className="relative z-10">
                <Brain
                  className="mx-auto mb-4 h-16 w-16 text-violet-500"
                  style={{ filter: 'drop-shadow(0 0 15px rgba(139,92,246,0.4))' }}
                />
                <h2 className="text-2xl font-bold">{quiz.title}</h2>
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

              <div className="relative z-10 mt-2">
                {quiz.questions.length > 0 ? (
                  <StartQuizButton quizId={quizId} courseSlug={slug} />
                ) : (
                  <p className="text-muted-foreground text-sm italic">Quiz chưa có câu hỏi.</p>
                )}
              </div>
            </div>

            {myAttempts.length > 0 && (
              <div className="border-border/60 bg-card/40 overflow-hidden rounded-2xl border shadow-lg backdrop-blur-md">
                <div className="border-border/50 bg-muted/20 flex items-center gap-2 border-b px-6 py-4">
                  <RotateCcw className="h-5 w-5 text-violet-500" />
                  <h2 className="text-lg font-bold">Lịch sử làm bài</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {myAttempts.map((a, i) => {
                      const pct =
                        a.maxScore && a.maxScore > 0
                          ? Math.round(((a.score ?? 0) / a.maxScore) * 100)
                          : null;
                      const AT_CLASS: Record<string, string> = {
                        IN_PROGRESS: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                        SUBMITTED: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                        GRADED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
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
                          className="border-border bg-card hover:bg-muted/50 group flex flex-col items-start gap-4 rounded-xl border px-5 py-4 transition-all hover:border-violet-500/40 sm:flex-row sm:items-center"
                        >
                          <div className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-colors group-hover:bg-violet-500/10 group-hover:text-violet-500">
                            #{myAttempts.length - i}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span
                                className={cn(
                                  'rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase',
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
                                <p className="mt-0.5 text-xs font-bold text-violet-500">{pct}%</p>
                              )}
                            </div>
                          )}

                          <ChevronRight className="text-muted-foreground/30 ml-2 h-5 w-5 transition-all group-hover:translate-x-1 group-hover:text-violet-500" />
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
          <div className="border-border/60 bg-card/40 overflow-hidden rounded-2xl border shadow-lg backdrop-blur-md">
            <div className="border-border/50 bg-muted/20 flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4">
              <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-violet-500" />
                <h2 className="text-lg font-bold">
                  Danh sách câu hỏi{' '}
                  <span className="text-muted-foreground ml-1 font-normal">
                    ({quiz.questions.length})
                  </span>
                </h2>
              </div>
              {canManage && (
                <div className="flex items-center gap-4">
                  <Link
                    href={`/courses/${slug}/quizzes/${quizId}/preview`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-500 transition-colors hover:text-amber-400"
                  >
                    <Eye className="h-4 w-4" /> Xem thử
                  </Link>
                  <Link
                    href={`/courses/${slug}/quizzes/${quizId}/manage`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-500 transition-colors hover:text-violet-400"
                  >
                    <ListChecks className="h-4 w-4" /> Thêm / Xoá câu hỏi
                  </Link>
                </div>
              )}
            </div>

            <div className="p-6">
              {quiz.questions.length === 0 ? (
                <div className="border-border bg-muted/20 flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center">
                  <HelpCircle className="text-muted-foreground/30 h-12 w-12" />
                  <p className="text-muted-foreground text-sm font-medium">
                    Chưa có câu hỏi nào trong quiz.
                  </p>
                  {canManage && (
                    <Link
                      href={`/courses/${slug}/quizzes/${quizId}/manage`}
                      className="inline-flex items-center justify-center rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-600"
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
                      className="border-border bg-card flex items-center gap-4 rounded-xl border px-5 py-4 transition-colors hover:border-violet-500/30"
                    >
                      <div className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                        {idx + 1}
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase',
                          TYPE_BADGE[qq.question.type] ?? ''
                        )}
                      >
                        {TYPE_SHORT[qq.question.type] ?? qq.question.type}
                      </span>
                      <p className="line-clamp-2 min-w-0 flex-1 text-sm font-medium">
                        {qq.question.content}
                      </p>
                      {canManage ? (
                        <QuizQuestionPoints
                          quizQuestionId={qq.id}
                          initialPoints={qq.points ?? qq.question.points}
                        />
                      ) : (
                        <span className="text-muted-foreground bg-muted shrink-0 rounded-md px-2 py-1 text-sm font-bold">
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
