'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Brain, CheckCircle2, Circle, Clock, Send, Play, Loader2, XCircle } from 'lucide-react';
import { saveAnswerAction, submitAttemptAction, type AttemptData, type AnswerInput } from '@/actions/attempts';
import { checkQuizCodeAction, type TCCheckResult } from '@/actions/questions';
import { CodeEditor } from '@/components/ui/editor/CodeEditor';
import { WebCodeEditor } from '@/components/features/quiz/WebCodeEditor';
import { ParsonsQuestion } from '@/components/features/quiz/ParsonsQuestion';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { cn } from '@/lib/utils';
import type { CodeLanguage } from '@prisma/client';

// ── Seeded shuffle ─────────────────────────────────────────────
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    h ^= h << 13; h ^= h >> 17; h ^= h << 5;
    const j = Math.abs(h) % (i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

const CODE_LANG: Record<string, CodeLanguage> = {
  CODE_PYTHON:       'PYTHON3',
  CODE_CPP:          'CPP17',
  CODE_DEBUG_PYTHON: 'PYTHON3',
  CODE_DEBUG_CPP:    'CPP17',
};

type Props = { attempt: AttemptData; courseSlug: string };

export function QuizTaker({ attempt, courseSlug }: Props) {
  const router = useRouter();
  const [submitPending, startSubmitTransition] = useTransition();
  const [confirmDialog, openConfirm] = useConfirmDialog();
  const submitted = useRef(false);

  const questions = attempt.quiz.shuffleQuestions
    ? seededShuffle(attempt.questions, attempt.id)
    : attempt.questions;

  // ── Answer state ────────────────────────────────────────────
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const m: Record<string, string[]> = {};
    for (const a of attempt.answers) {
      if (a.selectedOptionIds) m[a.questionId] = a.selectedOptionIds;
    }
    return m;
  });
  const [booleans, setBooleans] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const a of attempt.answers) {
      if (a.booleanAnswer !== null) m[a.questionId] = a.booleanAnswer;
    }
    return m;
  });
  const [texts, setTexts] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const a of attempt.answers) {
      if (a.textAnswer !== null) m[a.questionId] = a.textAnswer;
    }
    return m;
  });

  // ── Code check state ─────────────────────────────────────────
  const [codeCheckResults, setCodeCheckResults] = useState<Record<string, TCCheckResult[]>>({});
  const [codeCheckPending, setCodeCheckPending] = useState<Record<string, boolean>>({});

  async function handleCheckCode(questionId: string, code: string) {
    if (!code.trim()) { toast.error('Chưa viết code.'); return; }
    setCodeCheckPending((prev) => ({ ...prev, [questionId]: true }));
    try {
      const res = await checkQuizCodeAction(questionId, code);
      if (res.success) {
        setCodeCheckResults((prev) => ({ ...prev, [questionId]: res.results }));
      } else {
        toast.error(res.error);
      }
    } finally {
      setCodeCheckPending((prev) => ({ ...prev, [questionId]: false }));
    }
  }

  // ── Essay / Code debounce ────────────────────────────────────
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Timer ────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState<number | null>(() => {
    if (!attempt.quiz.timeLimit) return null;
    const elapsed = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
    return Math.max(0, attempt.quiz.timeLimit * 60 - elapsed);
  });

  useEffect(() => {
    if (timeLeft === null || timeLeft === 0) {
      if (timeLeft === 0 && !submitted.current) {
        toast.error('Hết giờ! Bài đang tự động nộp...');
        doSubmit(true);
      }
      return;
    }
    const id = setInterval(() => setTimeLeft((t) => (t !== null ? t - 1 : null)), 1000);
    return () => clearInterval(id);
  }, [timeLeft]);

  // ── Save helpers ─────────────────────────────────────────────
  function fireSave(questionId: string, input: AnswerInput) {
    void saveAnswerAction(attempt.id, questionId, input);
  }

  function handleMCQSingle(questionId: string, optId: string) {
    setSelected((prev) => ({ ...prev, [questionId]: [optId] }));
    fireSave(questionId, { type: 'MCQ', selectedOptionIds: [optId] });
  }

  function handleMCQMulti(questionId: string, optId: string, checked: boolean) {
    const cur  = selected[questionId] ?? [];
    const next = checked ? [...cur, optId] : cur.filter((id) => id !== optId);
    setSelected((prev) => ({ ...prev, [questionId]: next }));
    fireSave(questionId, { type: 'MCQ', selectedOptionIds: next });
  }

  function handleTFMulti(questionId: string, optId: string, isDong: boolean) {
    const cur  = selected[questionId] ?? [];
    const next = isDong ? [...cur.filter((id) => id !== optId), optId] : cur.filter((id) => id !== optId);
    setSelected((prev) => ({ ...prev, [questionId]: next }));
    fireSave(questionId, { type: 'MCQ', selectedOptionIds: next });
  }

  function handleTF(questionId: string, value: boolean) {
    setBooleans((prev) => ({ ...prev, [questionId]: value }));
    fireSave(questionId, { type: 'TF', booleanAnswer: value });
  }

  function handleEssay(questionId: string, text: string) {
    setTexts((prev) => ({ ...prev, [questionId]: text }));
    if (debounceRef.current[questionId]) clearTimeout(debounceRef.current[questionId]);
    debounceRef.current[questionId] = setTimeout(() => {
      fireSave(questionId, { type: 'ESSAY', textAnswer: text });
    }, 800);
  }

  function handleCode(questionId: string, code: string) {
    setTexts((prev) => ({ ...prev, [questionId]: code }));
    if (debounceRef.current[questionId]) clearTimeout(debounceRef.current[questionId]);
    debounceRef.current[questionId] = setTimeout(() => {
      fireSave(questionId, { type: 'ESSAY', textAnswer: code });
    }, 1000);
  }

  // ── Submit ───────────────────────────────────────────────────
  function doSubmit(force = false) {
    if (submitted.current) return;
    submitted.current = true;
    startSubmitTransition(async () => {
      const res = await submitAttemptAction(attempt.id);
      if (res.success) {
        toast.success('Đã nộp bài thành công!');
        router.push(`/courses/${courseSlug}/quizzes/${attempt.quizId}/attempt/${attempt.id}`);
      } else {
        submitted.current = false;
        if (!force) toast.error(res.error);
      }
    });
  }

  async function handleSubmitClick() {
    const answered = questions.filter((q) => {
      const t = q.question.type;
      const codeTypes = ['ESSAY','CODE_PYTHON','CODE_CPP','CODE_WEB','CODE_DEBUG_PYTHON','CODE_DEBUG_CPP'];
      if (codeTypes.includes(t)) return (texts[q.questionId] ?? '').trim().length > 0;
      if (t === 'TRUE_FALSE') return booleans[q.questionId] !== undefined;
      if (t === 'PARSONS') { try { return (JSON.parse(texts[q.questionId] ?? '[]') as string[]).length > 0; } catch { return false; } }
      if (t === 'CODE_FILL') { try { return (JSON.parse(texts[q.questionId] ?? '[]') as string[]).some((v) => v.trim().length > 0); } catch { return false; } }
      return (selected[q.questionId]?.length ?? 0) > 0;
    });
    const unanswered = questions.length - answered.length;
    const msg = unanswered > 0
      ? `Bạn còn ${unanswered} câu chưa trả lời. Vẫn nộp bài?`
      : 'Xác nhận nộp bài?';
    const ok = await openConfirm(msg);
    if (ok) doSubmit();
  }

  // ── Timer display ────────────────────────────────────────────
  const timerDisplay = timeLeft !== null ? (() => {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  })() : null;

  const TYPE_LABEL: Record<string, string> = {
    MULTIPLE_CHOICE_SINGLE:   'Trắc nghiệm (1 đáp án)',
    MULTIPLE_CHOICE_MULTIPLE: 'Trắc nghiệm (nhiều đáp án)',
    TRUE_FALSE:               'Đúng / Sai',
    TRUE_FALSE_MULTI:         'Đúng / Sai (nhiều phát biểu)',
    ESSAY:                    'Tự luận',
    CODE_PYTHON:              'Code Python',
    CODE_CPP:                 'Code C++',
    CODE_WEB:                 'Code Web',
    PARSONS:                  'Sắp xếp code',
    CODE_FILL:                'Điền vào chỗ trống',
    CODE_DEBUG_PYTHON:        'Debug Python',
    CODE_DEBUG_CPP:           'Debug C++',
  };

  return (
    <>
      {confirmDialog}

      {/* Header */}
      <div className="rounded-2xl border border-border/60 bg-card px-6 py-4 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Brain className="h-4 w-4" />
          </div>
          <p className="font-bold text-lg truncate">{attempt.quiz.title}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {timerDisplay && (
            <span className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-mono font-semibold',
              timeLeft !== null && timeLeft < 60
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : 'border-border bg-background shadow-sm text-foreground',
            )}>
              <Clock className="h-4 w-4" />
              {timerDisplay}
            </span>
          )}
          <Button onClick={handleSubmitClick} disabled={submitPending} size="sm" className="gap-1.5 rounded-xl shadow-sm hover:-translate-y-0.5 transition-transform">
            <Send className="h-4 w-4" />
            {submitPending ? 'Đang nộp...' : 'Nộp bài'}
          </Button>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-8 pb-12">
        {questions.map((q, idx) => {
          const shuffledOpts = attempt.quiz.shuffleAnswers
            ? seededShuffle(q.question.options, attempt.id + q.questionId)
            : q.question.options;
          const qType = q.question.type;

          const isAnswered = (() => {
            const codeTypes = ['ESSAY','CODE_PYTHON','CODE_CPP','CODE_WEB','CODE_DEBUG_PYTHON','CODE_DEBUG_CPP'];
            if (codeTypes.includes(qType)) return (texts[q.questionId] ?? '').trim().length > 0;
            if (qType === 'TRUE_FALSE') return booleans[q.questionId] !== undefined;
            if (qType === 'PARSONS') {
              try { return (JSON.parse(texts[q.questionId] ?? '[]') as string[]).length > 0; }
              catch { return false; }
            }
            if (qType === 'CODE_FILL') {
              try {
                const arr = JSON.parse(texts[q.questionId] ?? '[]') as string[];
                return arr.some((v) => v.trim().length > 0);
              } catch { return false; }
            }
            return (selected[q.questionId]?.length ?? 0) > 0;
          })();

          const codeLang = CODE_LANG[qType];

          return (
            <div key={q.questionId} className="rounded-2xl border border-border bg-card p-6 space-y-4">
              {/* Question header */}
              <div className="flex items-start gap-3">
                <div className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  isAnswered
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}>
                  {isAnswered ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{TYPE_LABEL[qType] ?? qType}</span>
                    <span>·</span>
                    <span>{q.points} điểm</span>
                  </div>
                  <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{q.question.content}</p>
                </div>
              </div>

              {/* MCQ Single */}
              {qType === 'MULTIPLE_CHOICE_SINGLE' && (
                <div className="space-y-2 pl-10">
                  {shuffledOpts.map((opt) => {
                    const isChosen = selected[q.questionId]?.[0] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleMCQSingle(q.questionId, opt.id)}
                        className={cn(
                          'w-full flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm text-left transition-colors',
                          isChosen
                            ? 'border-primary bg-primary/10 text-primary font-medium'
                            : 'border-border bg-background hover:bg-muted/50',
                        )}
                      >
                        {isChosen
                          ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                          : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                        }
                        {opt.content}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* MCQ Multiple */}
              {qType === 'MULTIPLE_CHOICE_MULTIPLE' && (
                <div className="space-y-2 pl-10">
                  {shuffledOpts.map((opt) => {
                    const isChosen = (selected[q.questionId] ?? []).includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleMCQMulti(q.questionId, opt.id, !isChosen)}
                        className={cn(
                          'w-full flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm text-left transition-colors',
                          isChosen
                            ? 'border-primary bg-primary/10 text-primary font-medium'
                            : 'border-border bg-background hover:bg-muted/50',
                        )}
                      >
                        <span className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          isChosen ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-background',
                        )}>
                          {isChosen && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                        </span>
                        {opt.content}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* TRUE_FALSE */}
              {qType === 'TRUE_FALSE' && (
                <div className="flex gap-3 pl-10">
                  {[{ label: 'Đúng', value: true }, { label: 'Sai', value: false }].map(({ label, value }) => {
                    const isChosen = booleans[q.questionId] === value;
                    return (
                      <button
                        key={label}
                        onClick={() => handleTF(q.questionId, value)}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors',
                          isChosen
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-background hover:bg-muted/50 text-muted-foreground',
                        )}
                      >
                        {isChosen ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* TRUE_FALSE_MULTI */}
              {qType === 'TRUE_FALSE_MULTI' && (
                <div className="space-y-2 pl-10">
                  <p className="text-xs text-muted-foreground mb-1">Chọn Đúng hoặc Sai cho mỗi phát biểu:</p>
                  {shuffledOpts.map((opt, oi) => {
                    const dongSelected = (selected[q.questionId] ?? []).includes(opt.id);
                    const hasAnswer    = dongSelected || (selected[q.questionId] ?? []).length > 0;
                    return (
                      <div key={opt.id} className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-2.5">
                        <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                          {String.fromCharCode(97 + oi)}
                        </span>
                        <p className="flex-1 text-sm">{opt.content}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleTFMulti(q.questionId, opt.id, true)}
                            className={cn(
                              'rounded border px-3 py-1 text-xs font-medium transition-colors',
                              dongSelected
                                ? 'border-green-500 bg-green-500/15 text-green-700 dark:text-green-400'
                                : 'border-border text-muted-foreground hover:border-green-400 hover:bg-green-500/5 hover:text-green-600',
                            )}
                          >
                            Đúng
                          </button>
                          <button
                            onClick={() => {
                              const cur  = selected[q.questionId] ?? [];
                              // "Sai" = not in selectedOptionIds; just remove from the list
                              const next = cur.filter((id) => id !== opt.id);
                              // If was already "Sai" (not in list) and list was empty, we still call save to indicate "touched"
                              setSelected((prev) => ({ ...prev, [q.questionId]: next }));
                              fireSave(q.questionId, { type: 'MCQ', selectedOptionIds: next });
                            }}
                            className={cn(
                              'rounded border px-3 py-1 text-xs font-medium transition-colors',
                              !dongSelected && (selected[q.questionId] !== undefined)
                                ? 'border-red-400 bg-red-400/15 text-red-700 dark:text-red-400'
                                : 'border-border text-muted-foreground hover:border-red-400 hover:bg-red-400/5 hover:text-red-600',
                            )}
                          >
                            Sai
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ESSAY */}
              {qType === 'ESSAY' && (
                <div className="pl-10">
                  <textarea
                    value={texts[q.questionId] ?? ''}
                    onChange={(e) => handleEssay(q.questionId, e.target.value)}
                    placeholder="Nhập câu trả lời của bạn..."
                    rows={5}
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                </div>
              )}

              {/* CODE_PYTHON / CODE_CPP */}
              {(qType === 'CODE_PYTHON' || qType === 'CODE_CPP') && codeLang && (() => {
                const checkResults = codeCheckResults[q.questionId];
                const isPending    = codeCheckPending[q.questionId] ?? false;
                const passedCount  = checkResults?.filter((r) => r.passed).length ?? 0;
                const totalCount   = checkResults?.length ?? 0;
                const hasCompileErr = checkResults?.some((r) => r.statusId === 6) ?? false;
                const compileOutput = checkResults?.find((r) => r.statusId === 6)?.errorDetail ?? null;
                return (
                  <div className="pl-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Viết code {qType === 'CODE_PYTHON' ? 'Python' : 'C++'} — bài sẽ tự động chấm khi nộp.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => void handleCheckCode(q.questionId, texts[q.questionId] ?? '')}
                        className="gap-1.5 text-xs h-7 rounded-lg"
                      >
                        {isPending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Play className="h-3.5 w-3.5" />
                        }
                        {isPending ? 'Đang chạy...' : 'Kiểm tra'}
                      </Button>
                    </div>

                    <div className="rounded-xl border border-border overflow-hidden">
                      <CodeEditor
                        value={texts[q.questionId] ?? q.question.starterCode ?? ''}
                        onChange={(v) => handleCode(q.questionId, v)}
                        language={codeLang}
                        height={280}
                      />
                    </div>

                    {/* Check results panel */}
                    {checkResults && (
                      <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2 text-xs">
                        <div className={cn(
                          'flex items-center gap-2 font-semibold',
                          passedCount === totalCount ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400',
                        )}>
                          {passedCount === totalCount
                            ? <CheckCircle2 className="h-4 w-4" />
                            : <XCircle className="h-4 w-4" />
                          }
                          Kết quả: {passedCount}/{totalCount} test case đúng
                        </div>

                        {hasCompileErr && compileOutput && (
                          <div className="rounded-lg border border-red-400/40 bg-red-400/5 px-3 py-2">
                            <p className="font-semibold text-red-500 mb-1">Lỗi compile:</p>
                            <pre className="whitespace-pre-wrap font-mono text-red-500">{compileOutput}</pre>
                          </div>
                        )}

                        {!hasCompileErr && checkResults.map((tc, ri) => (
                          <div
                            key={ri}
                            className={cn(
                              'rounded-lg border px-3 py-2 space-y-1',
                              tc.passed
                                ? 'border-green-500/30 bg-green-500/5'
                                : 'border-red-400/30 bg-red-400/5',
                            )}
                          >
                            <div className={cn(
                              'flex items-center gap-1.5 font-medium',
                              tc.passed ? 'text-green-600 dark:text-green-400' : 'text-red-500',
                            )}>
                              {tc.passed
                                ? <CheckCircle2 className="h-3.5 w-3.5" />
                                : <XCircle className="h-3.5 w-3.5" />
                              }
                              Test #{tc.position + 1}{tc.isHidden ? ' (ẩn)' : ''} — {tc.statusDesc}
                            </div>
                            {!tc.isHidden && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                                <div>
                                  <p className="text-muted-foreground mb-0.5">Input:</p>
                                  <pre className="whitespace-pre-wrap font-mono bg-background rounded px-2 py-1 text-foreground">{tc.input || '(trống)'}</pre>
                                </div>
                                <div>
                                  <p className="text-muted-foreground mb-0.5">Expected:</p>
                                  <pre className="whitespace-pre-wrap font-mono bg-background rounded px-2 py-1 text-green-600 dark:text-green-400">{tc.expected}</pre>
                                </div>
                                <div>
                                  <p className="text-muted-foreground mb-0.5">Output của bạn:</p>
                                  <pre className={cn(
                                    'whitespace-pre-wrap font-mono bg-background rounded px-2 py-1',
                                    tc.passed ? 'text-green-600 dark:text-green-400' : 'text-red-500',
                                  )}>{tc.actual ?? '(trống)'}</pre>
                                </div>
                              </div>
                            )}
                            {!tc.isHidden && tc.errorDetail && (
                              <pre className="whitespace-pre-wrap font-mono text-red-500 text-[11px] pt-1">{tc.errorDetail}</pre>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* CODE_WEB */}
              {qType === 'CODE_WEB' && (
                <div className="pl-4 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Viết code HTML/CSS/JS — giáo viên sẽ xem và chấm điểm sau khi nộp.
                  </p>
                  <WebCodeEditor
                    value={texts[q.questionId] ?? (q.question as any).starterCode ?? ''}
                    onChange={(v) => handleCode(q.questionId, v)}
                  />
                </div>
              )}

              {/* CODE_DEBUG_PYTHON / CODE_DEBUG_CPP — identical UX to CODE_PYTHON/CPP */}
              {(qType === 'CODE_DEBUG_PYTHON' || qType === 'CODE_DEBUG_CPP') && (() => {
                const debugLang = CODE_LANG[qType]!;
                const checkResults = codeCheckResults[q.questionId];
                const isPending    = codeCheckPending[q.questionId] ?? false;
                const passedCount  = checkResults?.filter((r) => r.passed).length ?? 0;
                const totalCount   = checkResults?.length ?? 0;
                const hasCompileErr = checkResults?.some((r) => r.statusId === 6) ?? false;
                const compileOutput = checkResults?.find((r) => r.statusId === 6)?.errorDetail ?? null;
                return (
                  <div className="pl-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Tìm và sửa lỗi trong đoạn code {qType === 'CODE_DEBUG_PYTHON' ? 'Python' : 'C++'} — chấm tự động khi nộp.
                      </p>
                      <Button size="sm" variant="outline" disabled={isPending}
                        onClick={() => void handleCheckCode(q.questionId, texts[q.questionId] ?? '')}
                        className="gap-1.5 text-xs h-7 rounded-lg">
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        {isPending ? 'Đang chạy...' : 'Kiểm tra'}
                      </Button>
                    </div>
                    <div className="rounded-xl border border-orange-500/40 overflow-hidden">
                      <CodeEditor
                        value={texts[q.questionId] ?? (q.question as any).starterCode ?? ''}
                        onChange={(v) => handleCode(q.questionId, v)}
                        language={debugLang}
                        height={280}
                      />
                    </div>
                    {checkResults && (
                      <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2 text-xs">
                        <div className={cn('flex items-center gap-2 font-semibold',
                          passedCount === totalCount ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')}>
                          {passedCount === totalCount ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          Kết quả: {passedCount}/{totalCount} test case đúng
                        </div>
                        {hasCompileErr && compileOutput && (
                          <div className="rounded-lg border border-red-400/40 bg-red-400/5 px-3 py-2">
                            <p className="font-semibold text-red-500 mb-1">Lỗi compile:</p>
                            <pre className="whitespace-pre-wrap font-mono text-red-500">{compileOutput}</pre>
                          </div>
                        )}
                        {!hasCompileErr && checkResults.map((tc, ri) => (
                          <div key={ri} className={cn('rounded-lg border px-3 py-2 space-y-1',
                            tc.passed ? 'border-green-500/30 bg-green-500/5' : 'border-red-400/30 bg-red-400/5')}>
                            <div className={cn('flex items-center gap-1.5 font-medium',
                              tc.passed ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>
                              {tc.passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                              Test #{tc.position + 1}{tc.isHidden ? ' (ẩn)' : ''} — {tc.statusDesc}
                            </div>
                            {!tc.isHidden && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                                <div><p className="text-muted-foreground mb-0.5">Input:</p>
                                  <pre className="whitespace-pre-wrap font-mono bg-background rounded px-2 py-1">{tc.input || '(trống)'}</pre></div>
                                <div><p className="text-muted-foreground mb-0.5">Expected:</p>
                                  <pre className="whitespace-pre-wrap font-mono bg-background rounded px-2 py-1 text-green-600 dark:text-green-400">{tc.expected}</pre></div>
                                <div><p className="text-muted-foreground mb-0.5">Output của bạn:</p>
                                  <pre className={cn('whitespace-pre-wrap font-mono bg-background rounded px-2 py-1',
                                    tc.passed ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>{tc.actual ?? '(trống)'}</pre></div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* PARSONS — drag-and-drop line ordering */}
              {qType === 'PARSONS' && (() => {
                const sortedLines = [...q.question.options].sort((a, b) => a.position - b.position);
                const savedRaw = texts[q.questionId];
                let initialLines;
                if (savedRaw) {
                  try {
                    const ids = JSON.parse(savedRaw) as string[];
                    initialLines = ids.map((id) => sortedLines.find((o) => o.id === id)!).filter(Boolean);
                    if (initialLines.length !== sortedLines.length) throw new Error('mismatch');
                  } catch { initialLines = seededShuffle(sortedLines, attempt.id + q.questionId); }
                } else {
                  initialLines = seededShuffle(sortedLines, attempt.id + q.questionId);
                }
                return (
                  <div className="pl-4 space-y-2">
                    <p className="text-xs text-muted-foreground">Kéo thả các dòng để sắp xếp đúng thứ tự.</p>
                    <ParsonsQuestion
                      initialLines={initialLines.map((o) => ({ id: o.id, content: o.content }))}
                      onChange={(orderedIds) => {
                        const json = JSON.stringify(orderedIds);
                        setTexts((prev) => ({ ...prev, [q.questionId]: json }));
                        fireSave(q.questionId, { type: 'ESSAY', textAnswer: json });
                      }}
                    />
                  </div>
                );
              })()}

              {/* CODE_FILL — fill-in-the-blank */}
              {qType === 'CODE_FILL' && (() => {
                const template = (q.question as any).starterCode ?? '';
                const blankCount = q.question.options.length;
                let fills: string[] = Array(blankCount).fill('');
                if (texts[q.questionId]) {
                  try { fills = JSON.parse(texts[q.questionId]!) as string[]; } catch { /**/ }
                }
                const parts = template.split('___');
                return (
                  <div className="pl-4 space-y-4">
                    {/* Template with numbered placeholders */}
                    <div className="rounded-xl border border-border bg-muted/20 p-4 font-mono text-sm whitespace-pre-wrap leading-relaxed overflow-x-auto">
                      {parts.map((part: string, pi: number) => (
                        <span key={pi}>
                          {part}
                          {pi < parts.length - 1 && (
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 bg-violet-500/20 text-violet-700 dark:text-violet-300 font-bold text-xs not-italic mx-0.5">
                              [{pi + 1}]
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                    {/* Input fields */}
                    <div className="space-y-2">
                      {Array.from({ length: blankCount }, (_, bi) => (
                        <div key={bi} className="flex items-center gap-3">
                          <span className="shrink-0 rounded border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-xs font-bold text-violet-700 dark:text-violet-400 min-w-[2rem] text-center">
                            [{bi + 1}]
                          </span>
                          <input
                            value={fills[bi] ?? ''}
                            onChange={(e) => {
                              const next = [...fills];
                              next[bi] = e.target.value;
                              const json = JSON.stringify(next);
                              setTexts((prev) => ({ ...prev, [q.questionId]: json }));
                              clearTimeout(debounceRef.current[q.questionId + bi]);
                              debounceRef.current[q.questionId + bi] = setTimeout(() => {
                                fireSave(q.questionId, { type: 'ESSAY', textAnswer: json });
                              }, 800);
                            }}
                            placeholder={`Điền vào ô số ${bi + 1}...`}
                            className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Bottom submit */}
      <div className="flex justify-end pt-4 border-t border-border">
        <Button onClick={handleSubmitClick} disabled={submitPending} size="lg" className="gap-2">
          <Send className="h-4 w-4" />
          {submitPending ? 'Đang nộp...' : 'Nộp bài'}
        </Button>
      </div>
    </>
  );
}
