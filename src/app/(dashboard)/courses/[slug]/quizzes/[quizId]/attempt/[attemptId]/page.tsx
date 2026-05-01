import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getAttemptAction } from '@/actions/attempts';
import { getCourseBySlugAction } from '@/actions/courses';
import { QuizTaker } from '@/components/features/quiz/QuizTaker';
import { EssayGrader } from '@/components/features/quiz/EssayGrader';
import { hasMinRole } from '@/lib/permissions';
import { CheckCircle2, XCircle, Minus, Brain } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { UserRole } from '@prisma/client';

export const metadata = { title: 'Làm bài' };

const TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE_SINGLE:   'Trắc nghiệm (1 đáp án)',
  MULTIPLE_CHOICE_MULTIPLE: 'Trắc nghiệm (nhiều đáp án)',
  TRUE_FALSE:               'Đúng / Sai',
  ESSAY:                    'Tự luận',
};

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ slug: string; quizId: string; attemptId: string }>;
}) {
  const { slug, quizId, attemptId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const role = session.user.role as UserRole;

  const [course, attempt] = await Promise.all([
    getCourseBySlugAction(slug),
    getAttemptAction(attemptId),
  ]);

  if (!course) notFound();
  if (!attempt) notFound();
  if (attempt.quizId !== quizId) notFound();

  const isStaff   = hasMinRole(role, 'TA');
  const isOwn     = attempt.studentId === session.user.id;
  const canManage = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session.user.id);

  if (!isOwn && !isStaff) notFound();

  // In-progress attempt → quiz taking UI
  if (attempt.status === 'IN_PROGRESS') {
    if (!isOwn) redirect(`/courses/${slug}/quizzes/${quizId}/attempts`);
    return (
      <div className="max-w-3xl mx-auto">
        <QuizTaker attempt={attempt} courseSlug={slug} />
      </div>
    );
  }

  // ── Results view ───────────────────────────────────────────────
  const { score, maxScore, quiz } = attempt;
  const hasEssay = attempt.questions.some((q) => q.question.type === 'ESSAY');
  const ungradedEssay = attempt.answers.some(
    (a) => {
      const q = attempt.questions.find((qq) => qq.questionId === a.questionId);
      return q?.question.type === 'ESSAY' && a.score === null;
    },
  );

  const pct = maxScore && maxScore > 0 ? Math.round(((score ?? 0) / maxScore) * 100) : null;
  const passed = quiz.passingScore != null && pct != null && pct >= quiz.passingScore;

  // Duration
  const durationMs = attempt.submittedAt
    ? new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime()
    : null;
  const durationMin = durationMs !== null ? Math.floor(durationMs / 60000) : null;
  const durationSec = durationMs !== null ? Math.floor((durationMs % 60000) / 1000) : null;

  // Score scaled to 10
  const score10 = maxScore && maxScore > 0
    ? Math.round(((score ?? 0) / maxScore) * 100) / 10
    : null;

  const correctCount = attempt.answers.filter((a) => a.isCorrect === true).length;
  const autoGradedCount = attempt.questions.filter((q) => q.question.type !== 'ESSAY').length;

  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-muted/20 -mx-6 -mt-6 mb-6 px-6 py-4 border-b border-border flex items-center gap-3">
        <Brain className="h-4 w-4 text-primary" />
        <Link href={`/courses/${slug}/quizzes`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Quiz
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <Link href={`/courses/${slug}/quizzes/${quizId}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate">
          {quiz.title}
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-medium">Kết quả</span>
      </div>

      {/* Score card */}
      <div className={cn(
        'rounded-2xl border-2 p-8 text-center space-y-2',
        attempt.status === 'SUBMITTED' && ungradedEssay
          ? 'border-amber-500/30 bg-amber-500/5'
          : passed
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-primary/20 bg-primary/5',
      )}>
        <div className={cn(
          'text-6xl font-bold',
          attempt.status === 'SUBMITTED' && ungradedEssay ? 'text-amber-600 dark:text-amber-400'
          : passed ? 'text-green-600 dark:text-green-400'
          : 'text-foreground',
        )}>
          {score ?? 0}<span className="text-2xl text-muted-foreground">/{maxScore ?? '?'}</span>
        </div>
        {pct !== null && (
          <p className="text-2xl font-semibold text-muted-foreground">{pct}%</p>
        )}
        {quiz.passingScore != null && (
          <p className={cn('text-sm font-medium', passed ? 'text-green-600 dark:text-green-400' : 'text-destructive')}>
            {passed ? '✓ Đạt yêu cầu' : '✗ Chưa đạt'} (ngưỡng {quiz.passingScore}%)
          </p>
        )}
        {ungradedEssay && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
            Điểm chưa đầy đủ — đang chờ chấm điểm câu tự luận
          </p>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Thời gian làm</p>
          <p className="mt-1 text-lg font-bold">
            {durationMin !== null
              ? durationMin > 0
                ? `${durationMin}p ${durationSec}s`
                : `${durationSec}s`
              : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Điểm hệ 10</p>
          <p className={cn('mt-1 text-lg font-bold', passed ? 'text-green-600 dark:text-green-400' : '')}>
            {score10 !== null ? score10.toFixed(1) : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Câu đúng</p>
          <p className="mt-1 text-lg font-bold">
            {correctCount}<span className="text-sm text-muted-foreground">/{autoGradedCount}</span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Điểm thô</p>
          <p className="mt-1 text-lg font-bold">
            {score ?? 0}<span className="text-sm text-muted-foreground">/{maxScore ?? '?'}</span>
          </p>
        </div>
      </div>

      {/* Per-question breakdown (if showResults) */}
      {(quiz.showResults || isStaff) && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Chi tiết câu hỏi</h2>
          {attempt.questions.map((q, idx) => {
            const ans     = answerMap.get(q.questionId);
            const qType   = q.question.type;
            const isEssay = qType === 'ESSAY';

            let resultIcon = <Minus className="h-4 w-4 text-muted-foreground" />;
            if (!isEssay && ans) {
              resultIcon = ans.isCorrect
                ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                : <XCircle className="h-4 w-4 text-destructive" />;
            }

            return (
              <div key={q.questionId} className="rounded-xl border border-border bg-card p-5 space-y-3">
                {/* Question header */}
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                    {resultIcon}
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{TYPE_LABEL[qType]}</span>
                      <span>·</span>
                      <span>
                        {isEssay
                          ? (ans?.score != null ? `${ans.score}/${q.points}` : `?/${q.points}`)
                          : `${ans?.isCorrect ? q.points : 0}/${q.points}`
                        } điểm
                      </span>
                    </div>
                    <p className="text-sm font-medium">{q.question.content}</p>
                  </div>
                </div>

                {/* MCQ options */}
                {(qType === 'MULTIPLE_CHOICE_SINGLE' || qType === 'MULTIPLE_CHOICE_MULTIPLE') && (
                  <div className="space-y-1.5 pl-9">
                    {q.question.options.map((opt) => {
                      const isSelected = (ans?.selectedOptionIds ?? []).includes(opt.id);
                      const isCorrect  = opt.isCorrect;
                      return (
                        <div
                          key={opt.id}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                            isCorrect   ? 'border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400'
                            : isSelected ? 'border-destructive/30 bg-destructive/5 text-destructive'
                            : 'border-border bg-muted/20 text-muted-foreground',
                          )}
                        >
                          {isCorrect
                            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            : isSelected
                            ? <XCircle className="h-3.5 w-3.5 shrink-0" />
                            : <Circle className="h-3.5 w-3.5 shrink-0 opacity-40" />
                          }
                          {opt.content}
                          {isSelected && !isCorrect && <span className="ml-auto text-xs opacity-60">Bạn chọn</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* TRUE_FALSE */}
                {qType === 'TRUE_FALSE' && (
                  <div className="flex gap-2 pl-9">
                    {q.question.options.map((opt) => {
                      const studentChoseDong = ans?.booleanAnswer === true;
                      const isDong = opt.content === 'Đúng';
                      const isSelected = isDong ? studentChoseDong : !studentChoseDong && ans?.booleanAnswer !== undefined;
                      return (
                        <span
                          key={opt.id}
                          className={cn(
                            'rounded-lg border px-3 py-1.5 text-xs font-medium',
                            opt.isCorrect ? 'border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400'
                            : isSelected ? 'border-destructive/30 bg-destructive/5 text-destructive'
                            : 'border-border bg-muted/20 text-muted-foreground',
                          )}
                        >
                          {opt.content}
                          {opt.isCorrect ? ' ✓' : ''}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* ESSAY */}
                {isEssay && (
                  <div className="pl-9 space-y-3">
                    {ans?.textAnswer ? (
                      <div className="rounded-lg bg-muted/30 px-4 py-3 text-sm whitespace-pre-wrap">
                        {ans.textAnswer}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Không có câu trả lời</p>
                    )}
                    {ans?.feedback && (
                      <div className="rounded-lg border border-border bg-card px-4 py-3 text-xs space-y-1">
                        <p className="font-medium text-muted-foreground">Nhận xét của giáo viên:</p>
                        <p className="whitespace-pre-wrap">{ans.feedback}</p>
                      </div>
                    )}
                    {canManage && ans && (
                      <EssayGrader
                        answerId={ans.id}
                        maxPoints={q.points}
                        initialScore={ans.score}
                        initialFeedback={ans.feedback}
                      />
                    )}
                  </div>
                )}

                {/* Explanation */}
                {q.question.explanation && !isEssay && (
                  <div className="pl-9 rounded-lg bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                    <span className="font-medium">Giải thích: </span>
                    {q.question.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Back links */}
      <div className="flex items-center gap-3 pt-2">
        <Link
          href={`/courses/${slug}/quizzes/${quizId}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Về trang quiz
        </Link>
        {canManage && (
          <Link
            href={`/courses/${slug}/quizzes/${quizId}/attempts`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Xem tất cả bài làm →
          </Link>
        )}
      </div>
    </div>
  );
}

// Missing import for Circle — add it
function Circle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
