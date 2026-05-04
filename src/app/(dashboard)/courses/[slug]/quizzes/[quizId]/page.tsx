import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { getQuizAction } from '@/actions/quizzes';
import { listMyAttemptsAction } from '@/actions/attempts';
import { listCourseNavItemsAction, type CourseNavItem } from '@/actions/modules';
import { buttonVariants } from '@/components/ui/button';
import { DeleteQuizButton } from '@/components/features/quiz/DeleteQuizButton';
import { QuizStatusButton } from '@/components/features/quiz/QuizStatusButton';
import { QuizQuestionPoints } from '@/components/features/quiz/QuizQuestionPoints';
import { StartQuizButton } from '@/components/features/quiz/StartQuizButton';
import { hasMinRole } from '@/lib/permissions';
import {
  Brain, Clock, Pencil, CheckCircle2, Calendar,
  RotateCcw, HelpCircle, Users, ListChecks, ChevronLeft, ChevronRight, Target, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@prisma/client';

function navItemUrl(item: CourseNavItem, slug: string): string {
  if (item.type === 'LESSON'     && item.lessonId)     return `/courses/${slug}/lessons/${item.lessonId}`;
  if (item.type === 'ASSIGNMENT' && item.assignmentId) return `/courses/${slug}/assignments/${item.assignmentId}`;
  if (item.type === 'QUIZ'       && item.quizId)       return `/courses/${slug}/quizzes/${item.quizId}`;
  return `/courses/${slug}/modules`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; quizId: string }> }) {
  const { quizId } = await params;
  const quiz = await getQuizAction(quizId);
  return { title: quiz?.title ?? 'Quiz' };
}

const STATUS_CLASS: Record<string, string> = {
  DRAFT:     'bg-muted text-muted-foreground border-border',
  PUBLISHED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  CLOSED:    'bg-destructive/10 text-destructive border-destructive/20',
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp', PUBLISHED: 'Đã đăng', CLOSED: 'Đã đóng',
};
const TYPE_BADGE: Record<string, string> = {
  MULTIPLE_CHOICE_SINGLE:   'bg-blue-500/10 text-blue-500 border-blue-500/20',
  MULTIPLE_CHOICE_MULTIPLE: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  TRUE_FALSE:               'bg-amber-500/10 text-amber-500 border-amber-500/20',
  ESSAY:                    'bg-green-500/10 text-green-500 border-green-500/20',
};
const TYPE_SHORT: Record<string, string> = {
  MULTIPLE_CHOICE_SINGLE: 'TN-1', MULTIPLE_CHOICE_MULTIPLE: 'TN-N',
  TRUE_FALSE: 'Đ/S', ESSAY: 'TL',
};

function fmt(d: Date | null | undefined) {
  if (!d) return null;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));
}

export default async function QuizDetailPage({
  params,
}: {
  params: Promise<{ slug: string; quizId: string }>;
}) {
  const { slug, quizId } = await params;
  const session = await auth();
  const role    = session?.user?.role as UserRole | undefined;
  const userId  = session?.user?.id;

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const quiz = await getQuizAction(quizId);
  if (!quiz) notFound();

  const isStaff   = role ? hasMinRole(role, 'TA') : false;
  const canManage = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === userId);

  if (!isStaff && quiz.status !== 'PUBLISHED') notFound();

  const [myAttempts, allNavItems] = await Promise.all([
    !isStaff ? listMyAttemptsAction(quizId) : Promise.resolve([]),
    listCourseNavItemsAction(course.id, !isStaff),
  ]);
  const currentNavIndex = allNavItems.findIndex((i) => i.quizId === quizId);
  const prevNavItem = currentNavIndex > 0 ? allNavItems[currentNavIndex - 1] ?? null : null;
  const nextNavItem = currentNavIndex < allNavItems.length - 1 ? allNavItems[currentNavIndex + 1] ?? null : null;
  const totalPoints = quiz.questions.reduce((s, qq) => s + (qq.points ?? qq.question.points), 0);

  return (
    <div className="space-y-8">
      {/* ── Page hero header ────────────────────────────────── */}
      <div className="relative -mx-6 -mt-6 overflow-hidden border-b border-border bg-card">
        {/* Tech grid */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="quiz-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#quiz-grid)" />
        </svg>

        {/* Glow accents */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl" style={{ background: 'rgb(245 158 11 / 10%)' }} />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-32 w-64 rounded-full blur-3xl" style={{ background: 'oklch(0.80 0.13 210 / 0.06)' }} />

        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, rgb(245 158 11 / 60%), transparent)' }} />

        <div className="relative px-6 py-8">
          <Link href={`/courses/${slug}/modules`} className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors duration-150 mb-4">
            <ChevronLeft className="h-3.5 w-3.5" />
            Nội dung khoá học
          </Link>

          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-amber-500" style={{ filter: 'drop-shadow(0 0 6px #f59e0b)' }} />
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-500">Bài Trắc nghiệm</p>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{quiz.title}</h1>
              {quiz.description && (
                <p className="text-sm text-muted-foreground max-w-2xl mt-1">{quiz.description}</p>
              )}
              
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {canManage && (
                  <span className={cn('inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-xs font-semibold tracking-wide', STATUS_CLASS[quiz.status])}>
                    {STATUS_LABEL[quiz.status]}
                  </span>
                )}
                {allNavItems.length > 1 && currentNavIndex >= 0 && (
                  <span className="inline-flex items-center gap-1 rounded border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 tracking-wide">
                    Mục {currentNavIndex + 1}/{allNavItems.length}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tracking-wide">
                  <HelpCircle className="h-3 w-3" /> {quiz.questions.length} câu hỏi
                </span>
                {totalPoints > 0 && (
                  <span className="inline-flex items-center gap-1 rounded border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 tracking-wide">
                    <Target className="h-3 w-3" /> {totalPoints} điểm
                  </span>
                )}
                {quiz.timeLimit && (
                  <span className="inline-flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-500 tracking-wide">
                    <Clock className="h-3 w-3" /> {quiz.timeLimit} phút
                  </span>
                )}
                {quiz.maxAttempts && (
                  <span className="inline-flex items-center gap-1 rounded border border-muted-foreground/20 bg-muted/30 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground tracking-wide">
                    <RotateCcw className="h-3 w-3" /> Tối đa {quiz.maxAttempts} lần
                  </span>
                )}
                {quiz.dueDate && (
                  <span className="inline-flex items-center gap-1 rounded border border-destructive/20 bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive tracking-wide">
                    <Calendar className="h-3 w-3" /> Hạn: {fmt(quiz.dueDate)}
                  </span>
                )}
              </div>
            </div>

            {canManage && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <QuizStatusButton quizId={quizId} isPublished={quiz.status === 'PUBLISHED'} />
                <Link href={`/courses/${slug}/quizzes/${quizId}/manage`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <ListChecks className="h-3.5 w-3.5 mr-1 text-muted-foreground" /> Câu hỏi
                </Link>
                <Link href={`/courses/${slug}/quizzes/${quizId}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <Pencil className="h-3.5 w-3.5 mr-1 text-muted-foreground" /> Cài đặt
                </Link>
                <Link href={`/courses/${slug}/quizzes/${quizId}/attempts`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <Users className="h-3.5 w-3.5 mr-1 text-muted-foreground" /> Bài làm
                </Link>
                <DeleteQuizButton quizId={quizId} courseSlug={slug} />
              </div>
            )}
          </div>
        </div>

        {/* Progress bar — position in course */}
        {allNavItems.length > 1 && currentNavIndex >= 0 && (
          <div className="h-1 bg-muted">
            <div
              className="h-full bg-amber-500 transition-all duration-500"
              style={{ width: `${((currentNavIndex + 1) / allNavItems.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto w-full space-y-8 pb-12">
        {/* ── Student: start CTA + history ───────────────────── */}
        {!isStaff && (
          <div className="space-y-6">
            <div className="relative overflow-hidden flex flex-col items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/5 py-12 text-center gap-5 shadow-lg">
              <div className="absolute top-0 right-1/4 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
              <div className="absolute bottom-0 left-1/4 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
              
              <div className="relative z-10">
                <Brain className="h-16 w-16 mx-auto mb-4 text-violet-500" style={{ filter: 'drop-shadow(0 0 15px rgba(139,92,246,0.4))' }} />
                <h2 className="text-2xl font-bold">{quiz.title}</h2>
                <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground mt-3 font-medium">
                  <span>{quiz.questions.length} câu hỏi</span>
                  {quiz.timeLimit && <span>· {quiz.timeLimit} phút</span>}
                  {quiz.maxAttempts && <span>· Đã làm {myAttempts.filter((a) => a.status !== 'IN_PROGRESS').length}/{quiz.maxAttempts} lần</span>}
                </div>
              </div>
              
              <div className="relative z-10 mt-2">
                {quiz.questions.length > 0 ? (
                  <StartQuizButton quizId={quizId} courseSlug={slug} />
                ) : (
                  <p className="text-sm italic text-muted-foreground">Quiz chưa có câu hỏi.</p>
                )}
              </div>
            </div>

            {myAttempts.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-md shadow-lg overflow-hidden">
                <div className="border-b border-border/50 bg-muted/20 px-6 py-4 flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-violet-500" />
                  <h2 className="text-lg font-bold">Lịch sử làm bài</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {myAttempts.map((a, i) => {
                      const pct = a.maxScore && a.maxScore > 0
                        ? Math.round(((a.score ?? 0) / a.maxScore) * 100)
                        : null;
                      const AT_CLASS: Record<string, string> = {
                        IN_PROGRESS: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                        SUBMITTED:   'bg-amber-500/10 text-amber-500 border-amber-500/20',
                        GRADED:      'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                      };
                      const AT_LABEL: Record<string, string> = {
                        IN_PROGRESS: 'Đang làm', SUBMITTED: 'Đã nộp', GRADED: 'Đã chấm',
                      };
                      return (
                        <Link
                          key={a.id}
                          href={`/courses/${slug}/quizzes/${quizId}/attempt/${a.id}`}
                          className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 hover:border-violet-500/40 hover:bg-muted/50 transition-all group"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground group-hover:bg-violet-500/10 group-hover:text-violet-500 transition-colors">
                            #{myAttempts.length - i}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', AT_CLASS[a.status] ?? '')}>
                                {AT_LABEL[a.status] ?? a.status}
                              </span>
                            </div>
                            {a.submittedAt ? (
                              <p className="text-xs text-muted-foreground font-medium">Nộp lúc: {fmt(a.submittedAt)}</p>
                            ) : (
                              <p className="text-xs text-muted-foreground font-medium">Chưa nộp bài</p>
                            )}
                          </div>
                          
                          {a.score != null && (
                            <div className="text-right shrink-0">
                              <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold">{a.score}</span>
                                <span className="text-sm font-semibold text-muted-foreground">/{a.maxScore}</span>
                              </div>
                              {pct != null && <p className="text-xs font-bold text-violet-500 mt-0.5">{pct}%</p>}
                            </div>
                          )}
                          
                          <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-violet-500 group-hover:translate-x-1 transition-all ml-2" />
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
          <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-md shadow-lg overflow-hidden">
            <div className="border-b border-border/50 bg-muted/20 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-violet-500" />
                <h2 className="text-lg font-bold">Danh sách câu hỏi <span className="text-muted-foreground font-normal ml-1">({quiz.questions.length})</span></h2>
              </div>
              {canManage && (
                <div className="flex items-center gap-4">
                  <Link href={`/courses/${slug}/quizzes/${quizId}/preview`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-500 hover:text-amber-400 transition-colors">
                    <Eye className="h-4 w-4" /> Xem thử
                  </Link>
                  <Link href={`/courses/${slug}/quizzes/${quizId}/manage`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-500 hover:text-violet-400 transition-colors">
                    <ListChecks className="h-4 w-4" /> Thêm / Xoá câu hỏi
                  </Link>
                </div>
              )}
            </div>

            <div className="p-6">
              {quiz.questions.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center gap-4">
                  <HelpCircle className="h-12 w-12 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">Chưa có câu hỏi nào trong quiz.</p>
                  {canManage && (
                    <Link href={`/courses/${slug}/quizzes/${quizId}/manage`} className="inline-flex items-center justify-center rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-600">
                      <ListChecks className="h-4 w-4 mr-2" /> Thêm câu hỏi ngay
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {quiz.questions.map((qq, idx) => (
                    <div key={qq.questionId} className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 hover:border-violet-500/30 transition-colors">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                        {idx + 1}
                      </div>
                      <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', TYPE_BADGE[qq.question.type] ?? '')}>
                        {TYPE_SHORT[qq.question.type] ?? qq.question.type}
                      </span>
                      <p className="flex-1 min-w-0 text-sm font-medium line-clamp-2">{qq.question.content}</p>
                      {canManage ? (
                        <QuizQuestionPoints
                          quizQuestionId={qq.id}
                          initialPoints={qq.points ?? qq.question.points}
                        />
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground shrink-0 bg-muted px-2 py-1 rounded-md">
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
          <div className="grid grid-cols-2 gap-4 pt-6 border-t border-border">
            <div className="min-w-0">
              {prevNavItem ? (
                <Link href={navItemUrl(prevNavItem, slug)} className="inline-flex items-center gap-2 sm:gap-3 hover:text-primary transition-colors max-w-full group">
                  <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition-all" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-0.5">Bài trước</p>
                    <p className="text-sm font-semibold truncate max-w-[100px] sm:max-w-xs">{prevNavItem.title}</p>
                  </div>
                </Link>
              ) : (
                <Link href={`/courses/${slug}/modules`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronLeft className="h-4 w-4 shrink-0 group-hover:-translate-x-1 transition-transform" /> 
                  <span className="truncate">Về danh sách</span>
                </Link>
              )}
            </div>
            
            <div className="min-w-0 flex justify-end">
              {nextNavItem && (
                <Link href={navItemUrl(nextNavItem, slug)} className="inline-flex flex-row-reverse items-center gap-2 sm:gap-3 hover:text-primary transition-colors max-w-full text-right group">
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-0.5">Bài tiếp theo</p>
                    <p className="text-sm font-semibold truncate max-w-[100px] sm:max-w-xs">{nextNavItem.title}</p>
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
