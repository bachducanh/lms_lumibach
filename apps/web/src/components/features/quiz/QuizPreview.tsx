'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Brain,
  CheckCircle2,
  Circle,
  Eye,
  Play,
  Loader2,
  XCircle,
  RotateCcw,
  Minus,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { CodeEditor } from '@/components/ui/editor/CodeEditor';
import { WebCodeEditor } from '@/components/features/quiz/WebCodeEditor';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { PreviewQuizData, TCCheckResult } from '@lumibach/types';
import type { CodeLanguage } from '@lumibach/db';

// ── Constants ──────────────────────────────────────────────────

const CODE_LANG: Record<string, CodeLanguage> = {
  CODE_PYTHON: 'PYTHON3',
  CODE_CPP: 'CPP17',
};

const TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE_SINGLE: 'Trắc nghiệm (1 đáp án)',
  MULTIPLE_CHOICE_MULTIPLE: 'Trắc nghiệm (nhiều đáp án)',
  TRUE_FALSE: 'Đúng / Sai',
  TRUE_FALSE_MULTI: 'Đúng / Sai (nhiều phát biểu)',
  ESSAY: 'Tự luận',
  CODE_PYTHON: 'Code Python',
  CODE_CPP: 'Code C++',
  CODE_WEB: 'Code Web',
};

// ── Scoring helpers (mirrors submitAttemptAction logic) ────────

type ScoreResult = { score: number; isCorrect: boolean | null; unchecked?: boolean };

function computeScore(
  q: PreviewQuizQuestion,
  selected: Record<string, string[]>,
  booleans: Record<string, boolean>,
  texts: Record<string, string>,
  codeCheckResults: Record<string, TCCheckResult[]>
): ScoreResult {
  const type = q.question.type;
  const pts = q.points;
  const opts = q.question.options;

  if (type === 'MULTIPLE_CHOICE_SINGLE' || type === 'MULTIPLE_CHOICE_MULTIPLE') {
    const correctIds = opts
      .filter((o) => o.isCorrect)
      .map((o) => o.id)
      .sort();
    const selectedIds = (selected[q.questionId] ?? []).slice().sort();
    const isCorrect =
      correctIds.length > 0 &&
      correctIds.length === selectedIds.length &&
      correctIds.every((id, i) => id === selectedIds[i]);
    return { score: isCorrect ? pts : 0, isCorrect };
  }

  if (type === 'TRUE_FALSE') {
    const correctIsDong = opts.find((o) => o.content === 'Đúng')?.isCorrect ?? false;
    const boolVal = booleans[q.questionId];
    if (boolVal === undefined) return { score: 0, isCorrect: false };
    const isCorrect = boolVal === correctIsDong;
    return { score: isCorrect ? pts : 0, isCorrect };
  }

  if (type === 'TRUE_FALSE_MULTI') {
    const studentDong = new Set(selected[q.questionId] ?? []);
    let correct = 0;
    for (const opt of opts) {
      if (studentDong.has(opt.id) === opt.isCorrect) correct++;
    }
    const score = opts.length > 0 ? Math.round((correct / opts.length) * pts * 10) / 10 : 0;
    return { score, isCorrect: correct === opts.length };
  }

  if (type === 'CODE_PYTHON' || type === 'CODE_CPP') {
    const results = codeCheckResults[q.questionId];
    if (!results) return { score: 0, isCorrect: null, unchecked: true };
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    const score = total > 0 ? Math.round((passed / total) * pts * 10) / 10 : 0;
    return { score, isCorrect: passed === total };
  }

  // ESSAY, CODE_WEB
  return { score: 0, isCorrect: null };
}

// ── Props ──────────────────────────────────────────────────────

type Props = { quiz: PreviewQuizData; courseSlug: string };

// ── Main component ─────────────────────────────────────────────

export function QuizPreview({ quiz, courseSlug }: Props) {
  const [phase, setPhase] = useState<'answering' | 'review'>('answering');
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [booleans, setBooleans] = useState<Record<string, boolean>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [codeCheckResults, setCodeCheckResults] = useState<Record<string, TCCheckResult[]>>({});
  const [codeCheckPending, setCodeCheckPending] = useState<Record<string, boolean>>({});

  const questions = quiz.questions; // no shuffle in preview

  // ── Answer handlers (no DB save) ─────────────────────────────

  function handleMCQSingle(qId: string, optId: string) {
    setSelected((p) => ({ ...p, [qId]: [optId] }));
  }
  function handleMCQMulti(qId: string, optId: string, checked: boolean) {
    const cur = selected[qId] ?? [];
    const next = checked ? [...cur, optId] : cur.filter((id) => id !== optId);
    setSelected((p) => ({ ...p, [qId]: next }));
  }
  function handleTFMulti(qId: string, optId: string, isDong: boolean) {
    const cur = selected[qId] ?? [];
    const next = isDong
      ? [...cur.filter((id) => id !== optId), optId]
      : cur.filter((id) => id !== optId);
    setSelected((p) => ({ ...p, [qId]: next }));
  }
  function handleTF(qId: string, value: boolean) {
    setBooleans((p) => ({ ...p, [qId]: value }));
  }
  function handleText(qId: string, text: string) {
    setTexts((p) => ({ ...p, [qId]: text }));
  }

  async function handleCheckCode(qId: string, code: string) {
    if (!code.trim()) {
      toast.error('Chưa viết code.');
      return;
    }
    setCodeCheckPending((p) => ({ ...p, [qId]: true }));
    try {
      const results = await apiClient.post<TCCheckResult[]>(`/questions/${qId}/check-code`, {
        code,
      });
      setCodeCheckResults((p) => ({ ...p, [qId]: results }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
    } finally {
      setCodeCheckPending((p) => ({ ...p, [qId]: false }));
    }
  }

  function handleReset() {
    setPhase('answering');
    setSelected({});
    setBooleans({});
    setTexts({});
    setCodeCheckResults({});
  }

  // ── Review scores ─────────────────────────────────────────────

  const scores = questions.map((q) => computeScore(q, selected, booleans, texts, codeCheckResults));
  const knownScore = scores.reduce((s, r) => (r.isCorrect !== null ? s + r.score : s), 0);
  const maxScore = questions.reduce((s, q) => s + q.points, 0);
  const manualCount = scores.filter((r) => r.isCorrect === null && !r.unchecked).length;

  // ── Preview banner ────────────────────────────────────────────

  const PreviewBanner = (
    <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
      <Eye className="h-4 w-4 shrink-0" />
      <span>Chế độ xem thử — câu trả lời không được lưu lại, không tính điểm thực.</span>
    </div>
  );

  // ═══════════════ PHASE: REVIEW ═══════════════════════════════

  if (phase === 'review') {
    const pct = maxScore > 0 ? Math.round((knownScore / maxScore) * 100) : 0;
    return (
      <div className="space-y-6">
        {PreviewBanner}

        {/* Score summary */}
        <div className="border-border bg-card flex items-center justify-between gap-4 rounded-2xl border px-6 py-5">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Điểm ước tính
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold">{knownScore}</span>
              <span className="text-muted-foreground text-lg font-semibold">/{maxScore}</span>
              <span className="text-primary ml-2 text-sm font-bold">{pct}%</span>
            </div>
            {manualCount > 0 && (
              <p className="text-muted-foreground text-xs">
                ({manualCount} câu chấm tay chưa tính)
              </p>
            )}
          </div>
          <Button variant="outline" onClick={handleReset} className="gap-2 rounded-xl">
            <RotateCcw className="h-4 w-4" /> Làm lại
          </Button>
        </div>

        {/* Question review */}
        <div className="space-y-6 pb-12">
          {questions.map((q, idx) => {
            const qType = q.question.type;
            const opts = q.question.options;
            const sr = scores[idx]!;
            const isManual = qType === 'ESSAY' || qType === 'CODE_WEB';
            const isCodeAuto = qType === 'CODE_PYTHON' || qType === 'CODE_CPP';

            // Derive per-question selected state
            const selectedIds = selected[q.questionId] ?? [];
            const boolVal = booleans[q.questionId];
            const textVal = texts[q.questionId] ?? '';
            const checkResults = codeCheckResults[q.questionId];

            return (
              <div
                key={q.questionId}
                className="border-border bg-card space-y-4 rounded-2xl border p-6"
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      sr.isCorrect === true
                        ? 'bg-green-500 text-white'
                        : sr.isCorrect === false
                          ? 'bg-red-500 text-white'
                          : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {sr.isCorrect === true ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : sr.isCorrect === false ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                      <span>{TYPE_LABEL[qType] ?? qType}</span>
                      <span>·</span>
                      <span
                        className={cn(
                          'font-semibold',
                          isManual
                            ? 'text-muted-foreground'
                            : sr.isCorrect === true
                              ? 'text-green-600 dark:text-green-400'
                              : sr.unchecked
                                ? 'text-amber-500'
                                : 'text-red-500'
                        )}
                      >
                        {isManual
                          ? `?/${q.points}đ (chấm tay)`
                          : sr.unchecked
                            ? `?/${q.points}đ (chưa kiểm tra)`
                            : `${sr.score}/${q.points}đ`}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap">
                      {q.question.content}
                    </p>
                  </div>
                </div>

                {/* MCQ review */}
                {(qType === 'MULTIPLE_CHOICE_SINGLE' || qType === 'MULTIPLE_CHOICE_MULTIPLE') && (
                  <div className="space-y-2 pl-10">
                    {opts.map((opt) => {
                      const isChosen = selectedIds.includes(opt.id);
                      const isCorrect = opt.isCorrect;
                      return (
                        <div
                          key={opt.id}
                          className={cn(
                            'flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm',
                            isCorrect && isChosen
                              ? 'border-green-500 bg-green-500/10 font-medium text-green-700 dark:text-green-400'
                              : isCorrect && !isChosen
                                ? 'border-green-400/60 bg-green-500/5 text-green-600 dark:text-green-500'
                                : !isCorrect && isChosen
                                  ? 'border-red-400 bg-red-400/10 text-red-600 dark:text-red-400'
                                  : 'border-border bg-background text-muted-foreground'
                          )}
                        >
                          {isCorrect ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                          ) : isChosen ? (
                            <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                          ) : (
                            <Circle className="text-muted-foreground/30 h-4 w-4 shrink-0" />
                          )}
                          {opt.content}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* TRUE_FALSE review */}
                {qType === 'TRUE_FALSE' &&
                  (() => {
                    const correctIsDong =
                      opts.find((o) => o.content === 'Đúng')?.isCorrect ?? false;
                    return (
                      <div className="flex gap-3 pl-10">
                        {[
                          { label: 'Đúng', value: true },
                          { label: 'Sai', value: false },
                        ].map(({ label, value }) => {
                          const isCorrectAnswer = value === correctIsDong;
                          const isStudentAnswer = boolVal === value;
                          return (
                            <div
                              key={label}
                              className={cn(
                                'flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium',
                                isCorrectAnswer && isStudentAnswer
                                  ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400'
                                  : isCorrectAnswer
                                    ? 'border-green-400/60 bg-green-500/5 text-green-600 dark:text-green-500'
                                    : isStudentAnswer
                                      ? 'border-red-400 bg-red-400/10 text-red-600 dark:text-red-400'
                                      : 'border-border bg-background text-muted-foreground'
                              )}
                            >
                              {isCorrectAnswer ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : isStudentAnswer ? (
                                <XCircle className="h-4 w-4" />
                              ) : (
                                <Circle className="h-4 w-4" />
                              )}
                              {label}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                {/* TRUE_FALSE_MULTI review */}
                {qType === 'TRUE_FALSE_MULTI' && (
                  <div className="space-y-2 pl-10">
                    {opts.map((opt, oi) => {
                      const studentSaidTrue = selectedIds.includes(opt.id);
                      const isRight = studentSaidTrue === opt.isCorrect;
                      return (
                        <div
                          key={opt.id}
                          className={cn(
                            'flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm',
                            isRight
                              ? 'border-green-500/40 bg-green-500/5'
                              : 'border-red-400/40 bg-red-400/5'
                          )}
                        >
                          <span className="bg-muted text-muted-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                            {String.fromCharCode(97 + oi)}
                          </span>
                          <p className="flex-1 text-sm">{opt.content}</p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {isRight ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-400" />
                            )}
                            <span
                              className={cn(
                                'rounded border px-2 py-0.5 text-xs font-medium',
                                opt.isCorrect
                                  ? 'border-green-500 bg-green-500/15 text-green-700 dark:text-green-400'
                                  : 'border-red-400 bg-red-400/15 text-red-700 dark:text-red-400'
                              )}
                            >
                              {opt.isCorrect ? 'Đúng ✓' : 'Sai ✓'}
                            </span>
                            {studentSaidTrue !== opt.isCorrect && (
                              <span className="text-muted-foreground text-xs font-medium">
                                (bạn chọn: {studentSaidTrue ? 'Đúng' : 'Sai'})
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ESSAY review */}
                {qType === 'ESSAY' && (
                  <div className="pl-10">
                    {textVal ? (
                      <div className="border-border bg-muted/20 rounded-xl border px-4 py-3 text-sm whitespace-pre-wrap">
                        {textVal}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-xs italic">Chưa trả lời.</p>
                    )}
                    <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                      Câu tự luận — giáo viên chấm thủ công.
                    </p>
                  </div>
                )}

                {/* CODE_WEB review */}
                {qType === 'CODE_WEB' && (
                  <div className="space-y-2 pl-4">
                    {textVal ? (
                      <WebCodeEditor value={textVal} readOnly />
                    ) : (
                      <p className="text-muted-foreground pl-6 text-xs italic">Chưa viết code.</p>
                    )}
                    <p className="pl-6 text-xs font-medium text-amber-600 dark:text-amber-400">
                      Code Web — giáo viên chấm thủ công.
                    </p>
                  </div>
                )}

                {/* CODE_PYTHON/CPP review */}
                {isCodeAuto && (
                  <div className="space-y-2 pl-10">
                    {textVal && (
                      <div className="border-border overflow-hidden rounded-xl border">
                        <CodeEditor
                          value={textVal}
                          onChange={() => {}}
                          language={CODE_LANG[qType]!}
                          height={160}
                          readOnly
                        />
                      </div>
                    )}
                    {checkResults ? (
                      <div className="border-border bg-muted/20 space-y-1.5 rounded-xl border p-3 text-xs">
                        {checkResults.map((tc, ri) => (
                          <div
                            key={ri}
                            className={cn(
                              'flex items-center gap-2 rounded-lg border px-3 py-1.5',
                              tc.passed
                                ? 'border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400'
                                : 'border-red-400/30 bg-red-400/5 text-red-500'
                            )}
                          >
                            {tc.passed ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                            <span className="font-medium">
                              Test #{tc.position + 1}
                              {tc.isHidden ? ' (ẩn)' : ''}
                            </span>
                            <span className="text-muted-foreground">— {tc.statusDesc}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-xs italic">Chưa kiểm tra code.</p>
                    )}
                  </div>
                )}

                {/* Explanation */}
                {q.question.explanation && !isManual && (
                  <div className="pl-10">
                    <div className="border-primary/20 bg-primary/5 text-muted-foreground rounded-lg border px-3 py-2.5 text-xs">
                      <span className="text-primary font-semibold">Giải thích: </span>
                      {q.question.explanation}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-border flex justify-center border-t pt-4">
          <Button variant="outline" onClick={handleReset} className="gap-2 rounded-xl">
            <RotateCcw className="h-4 w-4" /> Làm lại từ đầu
          </Button>
        </div>
      </div>
    );
  }

  // ═══════════════ PHASE: ANSWERING ════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-border/60 bg-card flex items-center justify-between gap-4 rounded-2xl border px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full">
            <Brain className="h-4 w-4" />
          </div>
          <p className="truncate text-lg font-bold">{quiz.title}</p>
        </div>
        <Button
          size="sm"
          onClick={() => setPhase('review')}
          className="gap-1.5 rounded-xl shadow-sm"
        >
          <Eye className="h-4 w-4" />
          Xem kết quả
        </Button>
      </div>

      {PreviewBanner}

      {/* Questions */}
      <div className="space-y-8 pb-12">
        {questions.map((q, idx) => {
          const qType = q.question.type;
          const opts = q.question.options;
          const codeLang = CODE_LANG[qType];
          const checkResults = codeCheckResults[q.questionId];
          const isPending = codeCheckPending[q.questionId] ?? false;

          const isAnswered = (() => {
            if (
              qType === 'ESSAY' ||
              qType === 'CODE_PYTHON' ||
              qType === 'CODE_CPP' ||
              qType === 'CODE_WEB'
            )
              return (texts[q.questionId] ?? '').trim().length > 0;
            if (qType === 'TRUE_FALSE') return booleans[q.questionId] !== undefined;
            return (selected[q.questionId]?.length ?? 0) > 0;
          })();

          return (
            <div
              key={q.questionId}
              className="border-border bg-card space-y-4 rounded-2xl border p-6"
            >
              {/* Question header */}
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    isAnswered
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {isAnswered ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <span>{TYPE_LABEL[qType] ?? qType}</span>
                    <span>·</span>
                    <span>{q.points} điểm</span>
                  </div>
                  <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap">
                    {q.question.content}
                  </p>
                </div>
              </div>

              {/* MCQ Single */}
              {qType === 'MULTIPLE_CHOICE_SINGLE' && (
                <div className="space-y-2 pl-10">
                  {opts.map((opt) => {
                    const isChosen = selected[q.questionId]?.[0] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleMCQSingle(q.questionId, opt.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition-colors',
                          isChosen
                            ? 'border-primary bg-primary/10 text-primary font-medium'
                            : 'border-border bg-background hover:bg-muted/50'
                        )}
                      >
                        {isChosen ? (
                          <CheckCircle2 className="text-primary h-4 w-4 shrink-0" />
                        ) : (
                          <Circle className="text-muted-foreground/40 h-4 w-4 shrink-0" />
                        )}
                        {opt.content}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* MCQ Multiple */}
              {qType === 'MULTIPLE_CHOICE_MULTIPLE' && (
                <div className="space-y-2 pl-10">
                  {opts.map((opt) => {
                    const isChosen = (selected[q.questionId] ?? []).includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleMCQMulti(q.questionId, opt.id, !isChosen)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition-colors',
                          isChosen
                            ? 'border-primary bg-primary/10 text-primary font-medium'
                            : 'border-border bg-background hover:bg-muted/50'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                            isChosen
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground/40 bg-background'
                          )}
                        >
                          {isChosen && <CheckCircle2 className="text-primary-foreground h-3 w-3" />}
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
                  {[
                    { label: 'Đúng', value: true },
                    { label: 'Sai', value: false },
                  ].map(({ label, value }) => {
                    const isChosen = booleans[q.questionId] === value;
                    return (
                      <button
                        key={label}
                        onClick={() => handleTF(q.questionId, value)}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors',
                          isChosen
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-background hover:bg-muted/50 text-muted-foreground'
                        )}
                      >
                        {isChosen ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* TRUE_FALSE_MULTI */}
              {qType === 'TRUE_FALSE_MULTI' && (
                <div className="space-y-2 pl-10">
                  <p className="text-muted-foreground mb-1 text-xs">
                    Chọn Đúng hoặc Sai cho mỗi phát biểu:
                  </p>
                  {opts.map((opt, oi) => {
                    const dongSelected = (selected[q.questionId] ?? []).includes(opt.id);
                    return (
                      <div
                        key={opt.id}
                        className="border-border bg-background flex items-center gap-3 rounded-xl border px-4 py-2.5"
                      >
                        <span className="bg-muted text-muted-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                          {String.fromCharCode(97 + oi)}
                        </span>
                        <p className="flex-1 text-sm">{opt.content}</p>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => handleTFMulti(q.questionId, opt.id, true)}
                            className={cn(
                              'rounded border px-3 py-1 text-xs font-medium transition-colors',
                              dongSelected
                                ? 'border-green-500 bg-green-500/15 text-green-700 dark:text-green-400'
                                : 'border-border text-muted-foreground hover:border-green-400 hover:text-green-600'
                            )}
                          >
                            Đúng
                          </button>
                          <button
                            onClick={() => {
                              const cur = selected[q.questionId] ?? [];
                              const next = cur.filter((id) => id !== opt.id);
                              setSelected((p) => ({ ...p, [q.questionId]: next }));
                            }}
                            className={cn(
                              'rounded border px-3 py-1 text-xs font-medium transition-colors',
                              !dongSelected && selected[q.questionId] !== undefined
                                ? 'border-red-400 bg-red-400/15 text-red-700 dark:text-red-400'
                                : 'border-border text-muted-foreground hover:border-red-400 hover:text-red-600'
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
                    onChange={(e) => handleText(q.questionId, e.target.value)}
                    placeholder="Nhập câu trả lời của bạn..."
                    rows={5}
                    className="border-input bg-background focus:ring-ring w-full resize-none rounded-xl border px-4 py-3 text-sm focus:ring-1 focus:outline-none"
                  />
                </div>
              )}

              {/* CODE_PYTHON / CODE_CPP */}
              {(qType === 'CODE_PYTHON' || qType === 'CODE_CPP') && codeLang && (
                <div className="space-y-2 pl-4">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-xs">
                      Viết code {qType === 'CODE_PYTHON' ? 'Python' : 'C++'} — nhấn Kiểm tra để xem
                      kết quả.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => void handleCheckCode(q.questionId, texts[q.questionId] ?? '')}
                      className="h-7 gap-1.5 rounded-lg text-xs"
                    >
                      {isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      {isPending ? 'Đang chạy...' : 'Kiểm tra'}
                    </Button>
                  </div>
                  <div className="border-border overflow-hidden rounded-xl border">
                    <CodeEditor
                      value={texts[q.questionId] ?? q.question.starterCode ?? ''}
                      onChange={(v) => handleText(q.questionId, v)}
                      language={codeLang}
                      height={280}
                    />
                  </div>

                  {/* Check results */}
                  {checkResults && (
                    <div className="border-border bg-muted/20 space-y-2 rounded-xl border p-3 text-xs">
                      {(() => {
                        const passed = checkResults.filter((r) => r.passed).length;
                        const total = checkResults.length;
                        const hasCompileErr = checkResults.some((r) => r.statusId === 6);
                        const compileOut =
                          checkResults.find((r) => r.statusId === 6)?.errorDetail ?? null;
                        return (
                          <>
                            <div
                              className={cn(
                                'flex items-center gap-2 font-semibold',
                                passed === total
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              )}
                            >
                              {passed === total ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <Minus className="h-4 w-4" />
                              )}
                              {passed}/{total} test case đúng
                            </div>
                            {hasCompileErr && compileOut && (
                              <div className="rounded-lg border border-red-400/40 bg-red-400/5 px-3 py-2">
                                <p className="mb-1 font-semibold text-red-500">Lỗi compile:</p>
                                <pre className="font-mono whitespace-pre-wrap text-red-500">
                                  {compileOut}
                                </pre>
                              </div>
                            )}
                            {!hasCompileErr &&
                              checkResults.map((tc, ri) => (
                                <div
                                  key={ri}
                                  className={cn(
                                    'space-y-1 rounded-lg border px-3 py-2',
                                    tc.passed
                                      ? 'border-green-500/30 bg-green-500/5'
                                      : 'border-red-400/30 bg-red-400/5'
                                  )}
                                >
                                  <div
                                    className={cn(
                                      'flex items-center gap-1.5 font-medium',
                                      tc.passed
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-red-500'
                                    )}
                                  >
                                    {tc.passed ? (
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    ) : (
                                      <XCircle className="h-3.5 w-3.5" />
                                    )}
                                    Test #{tc.position + 1}
                                    {tc.isHidden ? ' (ẩn)' : ''} — {tc.statusDesc}
                                  </div>
                                  {!tc.isHidden && (
                                    <div className="grid grid-cols-3 gap-2 pt-1">
                                      <div>
                                        <p className="text-muted-foreground mb-0.5">Input:</p>
                                        <pre className="bg-background rounded px-2 py-1 font-mono whitespace-pre-wrap">
                                          {tc.input || '(trống)'}
                                        </pre>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground mb-0.5">Expected:</p>
                                        <pre className="bg-background rounded px-2 py-1 font-mono whitespace-pre-wrap text-green-600 dark:text-green-400">
                                          {tc.expected}
                                        </pre>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground mb-0.5">Output:</p>
                                        <pre
                                          className={cn(
                                            'bg-background rounded px-2 py-1 font-mono whitespace-pre-wrap',
                                            tc.passed
                                              ? 'text-green-600 dark:text-green-400'
                                              : 'text-red-500'
                                          )}
                                        >
                                          {tc.actual ?? '(trống)'}
                                        </pre>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* CODE_WEB */}
              {qType === 'CODE_WEB' && (
                <div className="space-y-2 pl-4">
                  <p className="text-muted-foreground text-xs">
                    Viết code HTML/CSS/JS — giáo viên sẽ chấm thủ công.
                  </p>
                  <WebCodeEditor
                    value={texts[q.questionId] ?? q.question.starterCode ?? ''}
                    onChange={(v) => handleText(q.questionId, v)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom button */}
      <div className="border-border flex justify-end border-t pt-4">
        <Button size="lg" onClick={() => setPhase('review')} className="gap-2">
          <Eye className="h-4 w-4" />
          Xem kết quả
        </Button>
      </div>
    </div>
  );
}
