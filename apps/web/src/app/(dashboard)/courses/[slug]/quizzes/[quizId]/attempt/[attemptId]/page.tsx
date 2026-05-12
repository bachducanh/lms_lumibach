import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getAttemptAction } from '@/actions/attempts';
import { getCourseBySlugAction } from '@/actions/courses';
import { QuizTaker } from '@/components/features/quiz/QuizTaker';
import { EssayGrader } from '@/components/features/quiz/EssayGrader';
import { CodeEditor } from '@/components/ui/editor/CodeEditor';
import { WebCodeEditor } from '@/components/features/quiz/WebCodeEditor';
import { ParsonsQuestion } from '@/components/features/quiz/ParsonsQuestion';
import { hasMinRole } from '@/lib/permissions';
import { CheckCircle2, XCircle, Minus, Brain, Code } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Làm bài' };

const CODE_LANG: Record<string, string> = {
  CODE_PYTHON: 'PYTHON3',
  CODE_CPP: 'CPP17',
  CODE_DEBUG_PYTHON: 'PYTHON3',
  CODE_DEBUG_CPP: 'CPP17',
};

const TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE_SINGLE: 'Trắc nghiệm (1 đáp án)',
  MULTIPLE_CHOICE_MULTIPLE: 'Trắc nghiệm (nhiều đáp án)',
  TRUE_FALSE: 'Đúng / Sai',
  TRUE_FALSE_MULTI: 'Đúng / Sai (nhiều phát biểu)',
  ESSAY: 'Tự luận',
  CODE_PYTHON: 'Code Python (tự chấm)',
  CODE_CPP: 'Code C++ (tự chấm)',
  CODE_WEB: 'Code Web (chấm tay)',
  PARSONS: 'Sắp xếp code',
  CODE_FILL: 'Điền vào chỗ trống',
  CODE_DEBUG_PYTHON: 'Debug Python',
  CODE_DEBUG_CPP: 'Debug C++',
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

  const isStaff = hasMinRole(role, 'TA');
  const isOwn = attempt.studentId === session.user.id;
  const canManage = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === session.user.id);

  if (!isOwn && !isStaff) notFound();

  // In-progress attempt → quiz taking UI
  if (attempt.status === 'IN_PROGRESS') {
    if (!isOwn) redirect(`/courses/${slug}/quizzes/${quizId}/attempts`);
    return (
      <div className="mx-auto max-w-5xl">
        <QuizTaker attempt={attempt} courseSlug={slug} />
      </div>
    );
  }

  // ── Results view ───────────────────────────────────────────────
  const { score, maxScore, quiz } = attempt;
  const MANUAL_TYPES = new Set(['ESSAY', 'CODE_WEB']); // types needing manual grading
  const hasEssay = attempt.questions.some((q) => MANUAL_TYPES.has(q.question.type));
  const ungradedEssay = attempt.answers.some((a) => {
    const q = attempt.questions.find((qq) => qq.questionId === a.questionId);
    return q && MANUAL_TYPES.has(q.question.type) && a.score === null;
  });

  const pct = maxScore && maxScore > 0 ? Math.round(((score ?? 0) / maxScore) * 100) : null;
  const passed = quiz.passingScore != null && pct != null && pct >= quiz.passingScore;

  // Duration
  const durationMs = attempt.submittedAt
    ? new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime()
    : null;
  const durationMin = durationMs !== null ? Math.floor(durationMs / 60000) : null;
  const durationSec = durationMs !== null ? Math.floor((durationMs % 60000) / 1000) : null;

  // Score scaled to 10
  const score10 =
    maxScore && maxScore > 0 ? Math.round(((score ?? 0) / maxScore) * 100) / 10 : null;

  const correctCount = attempt.answers.filter((a) => a.isCorrect === true).length;
  const autoGradedCount = attempt.questions.filter(
    (q) => !MANUAL_TYPES.has(q.question.type)
  ).length;

  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="bg-muted/20 border-border -mx-6 -mt-6 mb-6 flex items-center gap-3 border-b px-6 py-4">
        <Brain className="text-primary h-4 w-4" />
        <Link
          href={`/courses/${slug}/quizzes`}
          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          Quiz
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <Link
          href={`/courses/${slug}/quizzes/${quizId}`}
          className="text-muted-foreground hover:text-foreground truncate text-sm transition-colors"
        >
          {quiz.title}
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-medium">Kết quả</span>
      </div>

      {/* Score card */}
      <div
        className={cn(
          'space-y-2 rounded-2xl border-2 p-8 text-center',
          attempt.status === 'SUBMITTED' && ungradedEssay
            ? 'border-amber-500/30 bg-amber-500/5'
            : passed
              ? 'border-green-500/30 bg-green-500/5'
              : 'border-primary/20 bg-primary/5'
        )}
      >
        <div
          className={cn(
            'text-6xl font-bold',
            attempt.status === 'SUBMITTED' && ungradedEssay
              ? 'text-amber-600 dark:text-amber-400'
              : passed
                ? 'text-green-600 dark:text-green-400'
                : 'text-foreground'
          )}
        >
          {score ?? 0}
          <span className="text-muted-foreground text-2xl">/{maxScore ?? '?'}</span>
        </div>
        {pct !== null && <p className="text-muted-foreground text-2xl font-semibold">{pct}%</p>}
        {quiz.passingScore != null && (
          <p
            className={cn(
              'text-sm font-medium',
              passed ? 'text-green-600 dark:text-green-400' : 'text-destructive'
            )}
          >
            {passed ? '✓ Đạt yêu cầu' : '✗ Chưa đạt'} (ngưỡng {quiz.passingScore}%)
          </p>
        )}
        {ungradedEssay && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Điểm chưa đầy đủ — đang chờ chấm điểm câu tự luận
          </p>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border-border bg-card rounded-xl border px-4 py-3 text-center">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Thời gian làm
          </p>
          <p className="mt-1 text-lg font-bold">
            {durationMin !== null
              ? durationMin > 0
                ? `${durationMin}p ${durationSec}s`
                : `${durationSec}s`
              : '—'}
          </p>
        </div>
        <div className="border-border bg-card rounded-xl border px-4 py-3 text-center">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Điểm hệ 10
          </p>
          <p
            className={cn(
              'mt-1 text-lg font-bold',
              passed ? 'text-green-600 dark:text-green-400' : ''
            )}
          >
            {score10 !== null ? score10.toFixed(1) : '—'}
          </p>
        </div>
        <div className="border-border bg-card rounded-xl border px-4 py-3 text-center">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Câu đúng
          </p>
          <p className="mt-1 text-lg font-bold">
            {correctCount}
            <span className="text-muted-foreground text-sm">/{autoGradedCount}</span>
          </p>
        </div>
        <div className="border-border bg-card rounded-xl border px-4 py-3 text-center">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Điểm thô
          </p>
          <p className="mt-1 text-lg font-bold">
            {score ?? 0}
            <span className="text-muted-foreground text-sm">/{maxScore ?? '?'}</span>
          </p>
        </div>
      </div>

      {/* Per-question breakdown (if showResults) */}
      {(quiz.showResults || isStaff) && (
        <div className="space-y-4">
          <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
            Chi tiết câu hỏi
          </h2>
          {attempt.questions.map((q, idx) => {
            const ans = answerMap.get(q.questionId);
            const qType = q.question.type;
            const isManual = MANUAL_TYPES.has(qType);
            const isEssay = qType === 'ESSAY';
            const isCodeWeb = qType === 'CODE_WEB';
            const isCodeAuto = [
              'CODE_PYTHON',
              'CODE_CPP',
              'CODE_DEBUG_PYTHON',
              'CODE_DEBUG_CPP',
            ].includes(qType);
            const isTFMulti = qType === 'TRUE_FALSE_MULTI';
            const isParsons = qType === 'PARSONS';
            const isCodeFill = qType === 'CODE_FILL';

            let resultIcon = <Minus className="text-muted-foreground h-4 w-4" />;
            if (!isManual && ans) {
              resultIcon = ans.isCorrect ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="text-destructive h-4 w-4" />
              );
            }
            if (isManual && ans?.score != null) {
              resultIcon = <CheckCircle2 className="h-4 w-4 text-amber-500" />;
            }

            return (
              <div
                key={q.questionId}
                className="border-border bg-card space-y-3 rounded-xl border p-5"
              >
                {/* Question header */}
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                    {resultIcon}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                      <span>{TYPE_LABEL[qType] ?? qType}</span>
                      <span>·</span>
                      <span>
                        {isManual
                          ? ans?.score != null
                            ? `${ans.score}/${q.points}`
                            : `?/${q.points}`
                          : isCodeAuto || isParsons || isCodeFill
                            ? ans?.score != null
                              ? `${ans.score}/${q.points}`
                              : `0/${q.points}`
                            : `${ans?.isCorrect ? q.points : 0}/${q.points}`}{' '}
                        điểm
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
                      const isCorrect = opt.isCorrect;
                      return (
                        <div
                          key={opt.id}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                            isCorrect
                              ? 'border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400'
                              : isSelected
                                ? 'border-destructive/30 bg-destructive/5 text-destructive'
                                : 'border-border bg-muted/20 text-muted-foreground'
                          )}
                        >
                          {isCorrect ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          ) : isSelected ? (
                            <XCircle className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <Circle className="h-3.5 w-3.5 shrink-0 opacity-40" />
                          )}
                          {opt.content}
                          {isSelected && !isCorrect && (
                            <span className="ml-auto text-xs opacity-60">Bạn chọn</span>
                          )}
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
                      const isSelected = isDong
                        ? studentChoseDong
                        : !studentChoseDong && ans?.booleanAnswer !== undefined;
                      return (
                        <span
                          key={opt.id}
                          className={cn(
                            'rounded-lg border px-3 py-1.5 text-xs font-medium',
                            opt.isCorrect
                              ? 'border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400'
                              : isSelected
                                ? 'border-destructive/30 bg-destructive/5 text-destructive'
                                : 'border-border bg-muted/20 text-muted-foreground'
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
                  <div className="space-y-3 pl-9">
                    {ans?.textAnswer ? (
                      <div className="bg-muted/30 rounded-lg px-4 py-3 text-sm whitespace-pre-wrap">
                        {ans.textAnswer}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-xs italic">Không có câu trả lời</p>
                    )}
                    {ans?.feedback && (
                      <div className="border-border bg-card space-y-1 rounded-lg border px-4 py-3 text-xs">
                        <p className="text-muted-foreground font-medium">Nhận xét của giáo viên:</p>
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

                {/* TRUE_FALSE_MULTI */}
                {isTFMulti && (
                  <div className="space-y-1.5 pl-9">
                    {q.question.options.map((opt, oi) => {
                      const studentDong = (ans?.selectedOptionIds ?? []).includes(opt.id);
                      const correct = studentDong === opt.isCorrect;
                      return (
                        <div
                          key={opt.id}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                            correct
                              ? 'border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400'
                              : 'border-destructive/30 bg-destructive/5 text-destructive'
                          )}
                        >
                          <span className="bg-muted flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold">
                            {String.fromCharCode(97 + oi)}
                          </span>
                          <span className="flex-1">{opt.content}</span>
                          <span className="shrink-0 font-medium">
                            {studentDong ? 'Đúng' : 'Sai'}
                            {correct ? ' ✓' : ' ✗'}
                          </span>
                          <span className="text-muted-foreground shrink-0">
                            (đúng: {opt.isCorrect ? 'Đúng' : 'Sai'})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* CODE_PYTHON / CODE_CPP */}
                {isCodeAuto && (
                  <div className="space-y-2 pl-4">
                    {ans?.textAnswer ? (
                      <div className="border-border overflow-hidden rounded-xl border">
                        <CodeEditor
                          value={ans.textAnswer}
                          language={CODE_LANG[qType] ?? 'PYTHON3'}
                          height={220}
                          readOnly
                        />
                      </div>
                    ) : (
                      <p className="text-muted-foreground pl-5 text-xs italic">Không có code nộp</p>
                    )}
                    {ans?.score != null && (
                      <p className="text-muted-foreground flex items-center gap-1.5 pl-1 text-xs">
                        <Code className="h-3.5 w-3.5" />
                        Điểm auto-grader: {ans.score}/{q.points}
                      </p>
                    )}
                  </div>
                )}

                {/* CODE_WEB */}
                {isCodeWeb && (
                  <div className="space-y-3 pl-4">
                    {ans?.textAnswer ? (
                      <WebCodeEditor value={ans.textAnswer} readOnly />
                    ) : (
                      <p className="text-muted-foreground pl-5 text-xs italic">Không có code nộp</p>
                    )}
                    {ans?.feedback && (
                      <div className="border-border bg-card space-y-1 rounded-lg border px-4 py-3 text-xs">
                        <p className="text-muted-foreground font-medium">Nhận xét của giáo viên:</p>
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

                {/* CODE_DEBUG result — show submitted code + score */}
                {isCodeAuto && (qType === 'CODE_DEBUG_PYTHON' || qType === 'CODE_DEBUG_CPP') && (
                  <div className="space-y-2 pl-4">
                    {ans?.textAnswer ? (
                      <div className="overflow-hidden rounded-xl border border-orange-500/30">
                        <CodeEditor
                          value={ans.textAnswer}
                          language={CODE_LANG[qType] ?? 'PYTHON3'}
                          height={220}
                          readOnly
                        />
                      </div>
                    ) : (
                      <p className="text-muted-foreground pl-5 text-xs italic">Không có code nộp</p>
                    )}
                    {ans?.score != null && (
                      <p className="text-muted-foreground flex items-center gap-1.5 pl-1 text-xs">
                        <Code className="h-3.5 w-3.5" />
                        Điểm auto-grader: {ans.score}/{q.points}
                      </p>
                    )}
                  </div>
                )}

                {/* PARSONS result — show student's arrangement vs correct order */}
                {isParsons &&
                  (() => {
                    const sortedCorrect = [...q.question.options].sort(
                      (a, b) => a.position - b.position
                    );
                    let studentLines: typeof sortedCorrect = [];
                    if (ans?.textAnswer) {
                      try {
                        const ids = JSON.parse(ans.textAnswer) as string[];
                        studentLines = ids
                          .map((id) => sortedCorrect.find((o) => o.id === id)!)
                          .filter(Boolean);
                      } catch {
                        studentLines = [];
                      }
                    }
                    return (
                      <div className="space-y-3 pl-9">
                        {studentLines.length > 0 ? (
                          <div className="space-y-1.5">
                            <p className="text-muted-foreground text-xs font-medium">
                              Thứ tự bạn chọn:
                            </p>
                            {studentLines.map((line, li) => {
                              const isCorrectPos = sortedCorrect[li]?.id === line.id;
                              return (
                                <div
                                  key={line.id}
                                  className={cn(
                                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                                    isCorrectPos
                                      ? 'border-green-500/30 bg-green-500/5'
                                      : 'border-destructive/30 bg-destructive/5'
                                  )}
                                >
                                  <span className="text-muted-foreground w-4 shrink-0 tabular-nums">
                                    {li + 1}
                                  </span>
                                  <pre className="flex-1 overflow-x-auto font-mono whitespace-pre">
                                    {line.content}
                                  </pre>
                                  {isCorrectPos ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                                  ) : (
                                    <XCircle className="text-destructive h-3.5 w-3.5 shrink-0" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-xs italic">
                            Không có câu trả lời
                          </p>
                        )}
                        {ans?.score != null && sortedCorrect.length > 0 && (
                          <p className="text-muted-foreground text-xs">
                            Đúng {Math.round((ans.score / q.points) * sortedCorrect.length)}/
                            {sortedCorrect.length} vị trí — {ans.score}/{q.points} điểm
                          </p>
                        )}
                      </div>
                    );
                  })()}

                {/* CODE_FILL result — show each blank */}
                {isCodeFill &&
                  (() => {
                    const sortedBlanks = [...q.question.options].sort(
                      (a, b) => a.position - b.position
                    );
                    let fills: string[] = [];
                    if (ans?.textAnswer) {
                      try {
                        fills = JSON.parse(ans.textAnswer) as string[];
                      } catch {
                        fills = [];
                      }
                    }
                    const template = (q.question as any).starterCode ?? '';
                    const parts = template.split('___');
                    return (
                      <div className="space-y-3 pl-9">
                        {template && (
                          <div className="border-border bg-muted/20 overflow-x-auto rounded-xl border p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                            {parts.map((part: string, pi: number) => (
                              <span key={pi}>
                                {part}
                                {pi < parts.length - 1 && (
                                  <span
                                    className={cn(
                                      'mx-0.5 inline-flex items-center rounded px-1.5 py-0.5 font-bold',
                                      fills[pi]?.trim() === sortedBlanks[pi]?.content.trim()
                                        ? 'bg-green-500/20 text-green-700 dark:text-green-300'
                                        : 'bg-red-400/20 text-red-600 dark:text-red-400'
                                    )}
                                  >
                                    {fills[pi] || '(trống)'}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="space-y-1.5">
                          {sortedBlanks.map((blank, bi) => {
                            const student = (fills[bi] ?? '').trim();
                            const expected = blank.content.trim();
                            const correct = student === expected;
                            return (
                              <div
                                key={blank.id}
                                className={cn(
                                  'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs',
                                  correct
                                    ? 'border-green-500/30 bg-green-500/5'
                                    : 'border-destructive/30 bg-destructive/5'
                                )}
                              >
                                <span className="w-6 shrink-0 font-bold text-violet-600 dark:text-violet-400">
                                  [{bi + 1}]
                                </span>
                                <span
                                  className={cn(
                                    'flex-1 font-mono',
                                    correct
                                      ? 'text-green-700 dark:text-green-300'
                                      : 'text-destructive'
                                  )}
                                >
                                  {fills[bi] || '(trống)'}
                                </span>
                                {!correct && (
                                  <span className="text-muted-foreground font-mono">
                                    → {expected}
                                  </span>
                                )}
                                {correct ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                                ) : (
                                  <XCircle className="text-destructive h-3.5 w-3.5 shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                {/* Explanation */}
                {q.question.explanation &&
                  !isManual &&
                  !isCodeAuto &&
                  !(isParsons || isCodeFill) && (
                    <div className="bg-muted/30 text-muted-foreground rounded-lg px-4 py-3 pl-9 text-xs">
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
          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          ← Về trang quiz
        </Link>
        {canManage && (
          <Link
            href={`/courses/${slug}/quizzes/${quizId}/attempts`}
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
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
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
