'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Clock,
  Eye,
  FileQuestion,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Send,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type {
  PracticeAttemptAnswer,
  PracticeStudentAnswerInput,
  PracticeSubmitResult,
  PracticeTestDetail,
  PracticeTestQuestion,
} from '@lumibach/types';

type Result = {
  score: number;
  maxScore: number;
  answers: PracticeAttemptAnswer[];
};

type Props = {
  practiceTest: PracticeTestDetail;
  courseSlug: string;
  preview?: boolean;
};

const LETTERS = 'ABCDEFGH'.split('');
const TF_LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function normalizeText(value: string, caseSensitive: boolean) {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return caseSensitive ? cleaned : cleaned.toLocaleLowerCase('vi-VN');
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function scoreTrueFalseMulti(question: PracticeTestQuestion, correctCount: number) {
  const scores =
    question.correctAnswer && 'scoreByCorrectCount' in question.correctAnswer
      ? question.correctAnswer.scoreByCorrectCount
      : null;
  const configured = Array.isArray(scores) ? Number(scores[correctCount]) : Number.NaN;
  if (Number.isFinite(configured)) {
    return round2(Math.min(question.points, Math.max(0, configured)));
  }
  return question.statementCount > 0
    ? round2((correctCount / question.statementCount) * question.points)
    : 0;
}

function gradeQuestion(
  question: PracticeTestQuestion,
  answer: PracticeStudentAnswerInput
): PracticeAttemptAnswer {
  let score = 0;
  let isCorrect = false;

  if (question.type === 'MULTIPLE_CHOICE') {
    const expected =
      question.correctAnswer && 'option' in question.correctAnswer
        ? question.correctAnswer.option
        : null;
    isCorrect = !!answer.selectedOption && answer.selectedOption === expected;
    score = isCorrect ? question.points : 0;
  }

  if (question.type === 'TRUE_FALSE_MULTI') {
    const expected =
      question.correctAnswer && 'statements' in question.correctAnswer
        ? question.correctAnswer.statements
        : [];
    const student = answer.statementAnswers ?? [];
    let correct = 0;
    for (let index = 0; index < question.statementCount; index++) {
      if (typeof student[index] === 'boolean' && student[index] === expected[index]) correct++;
    }
    isCorrect = question.statementCount > 0 && correct === question.statementCount;
    score = scoreTrueFalseMulti(question, correct);
  }

  if (question.type === 'SHORT_ANSWER') {
    const expected =
      question.correctAnswer && 'answers' in question.correctAnswer
        ? question.correctAnswer.answers
        : [];
    const student = answer.textAnswer
      ? normalizeText(answer.textAnswer, question.caseSensitive)
      : '';
    isCorrect =
      !!student &&
      expected.some((value) => normalizeText(value, question.caseSensitive) === student);
    score = isCorrect ? question.points : 0;
  }

  return {
    id: '',
    questionId: question.id,
    selectedOption: answer.selectedOption ?? null,
    statementAnswers: answer.statementAnswers ?? null,
    textAnswer: answer.textAnswer ?? null,
    isCorrect,
    score,
  };
}

export function PracticeTestRunner({ practiceTest, courseSlug, preview = false }: Props) {
  const router = useRouter();
  const submitted = useRef(false);
  const [pending, startTransition] = useTransition();
  const [confirmDialog, openConfirm] = useConfirmDialog();
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [statements, setStatements] = useState<Record<string, (boolean | null)[]>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [answerPanelOpen, setAnswerPanelOpen] = useState(true);

  const [timeLeft, setTimeLeft] = useState<number | null>(() =>
    practiceTest.timeLimit ? practiceTest.timeLimit * 60 : null
  );

  const grouped = useMemo(
    () => ({
      mcq: practiceTest.questions.filter((q) => q.type === 'MULTIPLE_CHOICE'),
      tf: practiceTest.questions.filter((q) => q.type === 'TRUE_FALSE_MULTI'),
      short: practiceTest.questions.filter((q) => q.type === 'SHORT_ANSWER'),
    }),
    [practiceTest.questions]
  );

  const answers = useMemo<PracticeStudentAnswerInput[]>(
    () =>
      practiceTest.questions.map((question) => ({
        questionId: question.id,
        selectedOption: selected[question.id] ?? null,
        statementAnswers: statements[question.id] ?? null,
        textAnswer: texts[question.id] ?? null,
      })),
    [practiceTest.questions, selected, statements, texts]
  );

  const answeredCount = answers.filter((answer) => {
    const question = practiceTest.questions.find((q) => q.id === answer.questionId);
    if (!question) return false;
    if (question.type === 'MULTIPLE_CHOICE') return !!answer.selectedOption;
    if (question.type === 'TRUE_FALSE_MULTI') {
      return (
        (answer.statementAnswers ?? []).filter((v) => typeof v === 'boolean').length >=
        question.statementCount
      );
    }
    return !!answer.textAnswer?.trim();
  }).length;

  useEffect(() => {
    if (timeLeft === null || result) return;
    if (timeLeft <= 0) {
      if (!submitted.current) void submit(true);
      return;
    }
    const id = window.setInterval(
      () => setTimeLeft((value) => (value === null ? null : value - 1)),
      1000
    );
    return () => window.clearInterval(id);
  }, [timeLeft, result]);

  const timerDisplay =
    timeLeft !== null
      ? `${String(Math.max(0, Math.floor(timeLeft / 60))).padStart(2, '0')}:${String(Math.max(0, timeLeft % 60)).padStart(2, '0')}`
      : null;

  function updateStatement(questionId: string, index: number, value: boolean) {
    setStatements((prev) => {
      const question = practiceTest.questions.find((q) => q.id === questionId);
      const count = question?.statementCount ?? 4;
      const current = prev[questionId] ?? Array.from({ length: count }, () => null);
      const next = [...current];
      next[index] = value;
      return { ...prev, [questionId]: next };
    });
  }

  async function submit(force = false) {
    if (submitted.current) return;
    if (!force) {
      const unanswered = practiceTest.questions.length - answeredCount;
      const ok = await openConfirm(
        unanswered > 0
          ? `Bạn còn ${unanswered} câu chưa trả lời. Vẫn nộp bài?`
          : 'Xác nhận nộp bài?'
      );
      if (!ok) return;
    }

    submitted.current = true;
    startTransition(async () => {
      if (preview) {
        const gradedAnswers = practiceTest.questions.map((question) =>
          gradeQuestion(
            question,
            answers.find((answer) => answer.questionId === question.id) ?? {
              questionId: question.id,
            }
          )
        );
        setResult({
          score: round2(gradedAnswers.reduce((sum, answer) => sum + (answer.score ?? 0), 0)),
          maxScore: round2(
            practiceTest.questions.reduce((sum, question) => sum + question.points, 0)
          ),
          answers: gradedAnswers,
        });
        submitted.current = false;
        return;
      }

      try {
        const data = await apiClient.post<PracticeSubmitResult>(
          `/practice-tests/${practiceTest.id}/submit`,
          { answers }
        );
        toast.success('Đã nộp và chấm điểm.');
        router.push(
          `/courses/${courseSlug}/practice-tests/${practiceTest.id}/attempt/${data.attemptId}`
        );
      } catch (err) {
        submitted.current = false;
        toast.error(err instanceof Error ? err.message : 'Không thể nộp bài.');
      }
    });
  }

  return (
    <>
      {confirmDialog}
      <div className="space-y-4">
        <div className="border-border bg-card sticky top-0 z-20 flex flex-col gap-3 rounded-lg border px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500">
              {preview ? <Eye className="h-5 w-5" /> : <FileQuestion className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="truncate font-bold">{practiceTest.title}</p>
              <p className="text-muted-foreground text-xs">
                {answeredCount}/{practiceTest.questions.length} câu đã trả lời
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {timerDisplay && (
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-sm font-semibold',
                  timeLeft !== null && timeLeft < 60
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : 'border-border bg-background'
                )}
              >
                <Clock className="h-4 w-4" />
                {timerDisplay}
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setAnswerPanelOpen((value) => !value)}
              title={answerPanelOpen ? 'Thu gọn phiếu trả lời' : 'Mở phiếu trả lời'}
              aria-label={answerPanelOpen ? 'Thu gọn phiếu trả lời' : 'Mở phiếu trả lời'}
            >
              {answerPanelOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </Button>
            <Button onClick={() => void submit()} disabled={pending || !!result} size="sm">
              {pending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-4 w-4" />
              )}
              {preview ? 'Chấm thử' : 'Nộp bài'}
            </Button>
          </div>
        </div>

        {result && (
          <div className="border-primary/30 bg-primary/5 rounded-lg border px-5 py-4">
            <p className="text-muted-foreground text-xs font-semibold uppercase">Kết quả xem thử</p>
            <p className="mt-1 text-3xl font-bold">
              {result.score}
              <span className="text-muted-foreground text-lg">/{result.maxScore}</span>
            </p>
          </div>
        )}

        <div
          className={cn(
            'grid gap-4',
            answerPanelOpen
              ? 'xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]'
              : 'xl:grid-cols-[minmax(0,1fr)_64px]'
          )}
        >
          <section className="border-border bg-card overflow-hidden rounded-lg border">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">Đề bài PDF</p>
            </div>
            <iframe
              title={practiceTest.pdfName}
              src={practiceTest.pdfUrl}
              className="h-[70vh] min-h-[520px] w-full bg-white"
            />
          </section>

          <section className="border-border bg-card rounded-lg border">
            {answerPanelOpen ? (
              <>
                <div className="border-b px-4 py-3">
                  <p className="text-sm font-semibold">Phiếu trả lời</p>
                  <p className="text-muted-foreground text-xs">
                    Chọn đáp án theo số câu trong file PDF.
                  </p>
                </div>
                <div className="max-h-[calc(70vh+56px)] min-h-[520px] space-y-6 overflow-y-auto p-4">
                  <McqSheet
                    questions={grouped.mcq}
                    selected={selected}
                    disabled={!!result}
                    result={result}
                    onSelect={(questionId, option) =>
                      setSelected((prev) => ({ ...prev, [questionId]: option }))
                    }
                  />
                  <TfSheet
                    questions={grouped.tf}
                    statements={statements}
                    disabled={!!result}
                    result={result}
                    onSelect={updateStatement}
                  />
                  <ShortSheet
                    questions={grouped.short}
                    texts={texts}
                    disabled={!!result}
                    result={result}
                    onChange={(questionId, value) =>
                      setTexts((prev) => ({ ...prev, [questionId]: value }))
                    }
                  />
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setAnswerPanelOpen(true)}
                className="text-muted-foreground hover:text-foreground flex h-full min-h-[520px] w-full flex-col items-center justify-start gap-3 px-2 py-4"
                title="Mở phiếu trả lời"
                aria-label="Mở phiếu trả lời"
              >
                <PanelRightOpen className="h-5 w-5" />
                <span className="text-xs font-semibold tracking-wide [writing-mode:vertical-rl]">
                  Phiếu trả lời
                </span>
                <span className="rounded-full border px-2 py-1 text-xs font-bold">
                  {answeredCount}/{practiceTest.questions.length}
                </span>
              </button>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function ResultIcon({ answer }: { answer?: PracticeAttemptAnswer }) {
  if (!answer) return null;
  return answer.isCorrect ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  ) : (
    <XCircle className="text-destructive h-4 w-4" />
  );
}

function answerFor(result: Result | null, questionId: string) {
  return result?.answers.find((answer) => answer.questionId === questionId);
}

function McqSheet({
  questions,
  selected,
  disabled,
  result,
  onSelect,
}: {
  questions: PracticeTestQuestion[];
  selected: Record<string, string>;
  disabled: boolean;
  result: Result | null;
  onSelect: (questionId: string, option: string) => void;
}) {
  if (questions.length === 0) return null;
  return (
    <div className="space-y-3">
      <SectionTitle title="Trắc nghiệm" />
      <div className="overflow-hidden rounded-lg border">
        <div className="bg-muted/30 text-muted-foreground grid grid-cols-[44px_repeat(4,minmax(44px,1fr))_28px] border-b px-2 py-2 text-center text-xs font-bold">
          <span />
          {LETTERS.slice(0, 4).map((letter) => (
            <span key={letter}>{letter}</span>
          ))}
          <span />
        </div>
        {questions.map((question, qIndex) => {
          const answer = answerFor(result, question.id);
          return (
            <div
              key={question.id}
              className="grid grid-cols-[44px_repeat(4,minmax(44px,1fr))_28px] items-center px-2 py-2 text-center text-sm"
            >
              <span className="text-left font-semibold">{qIndex + 1}</span>
              {LETTERS.slice(0, 4).map((letter) => {
                const visible = letter.charCodeAt(0) - 64 <= question.optionCount;
                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={disabled || !visible}
                    onClick={() => onSelect(question.id, letter)}
                    className={cn(
                      'mx-auto flex h-6 w-6 items-center justify-center rounded-full border',
                      !visible && 'opacity-0',
                      selected[question.id] === letter
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/40 bg-background'
                    )}
                    aria-label={`Câu ${qIndex + 1} đáp án ${letter}`}
                  />
                );
              })}
              <ResultIcon answer={answer} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TfSheet({
  questions,
  statements,
  disabled,
  result,
  onSelect,
}: {
  questions: PracticeTestQuestion[];
  statements: Record<string, (boolean | null)[]>;
  disabled: boolean;
  result: Result | null;
  onSelect: (questionId: string, index: number, value: boolean) => void;
}) {
  if (questions.length === 0) return null;
  return (
    <div className="space-y-3">
      <SectionTitle title="Đúng / Sai nhiều phát biểu" />
      <div className="grid gap-3 sm:grid-cols-2">
        {questions.map((question, qIndex) => {
          const answer = answerFor(result, question.id);
          return (
            <div key={question.id} className="overflow-hidden rounded-lg border">
              <div className="bg-muted/30 text-muted-foreground grid grid-cols-[1fr_52px_52px_24px] px-2 py-2 text-center text-xs font-bold">
                <span className="text-left">Câu {qIndex + 1}</span>
                <span>Đúng</span>
                <span>Sai</span>
                <span />
              </div>
              {TF_LABELS.slice(0, question.statementCount).map((label, index) => {
                const value = statements[question.id]?.[index];
                return (
                  <div
                    key={label}
                    className="grid grid-cols-[1fr_52px_52px_24px] items-center px-2 py-2 text-center text-sm"
                  >
                    <span className="text-left font-semibold">{label})</span>
                    {[true, false].map((choice) => (
                      <button
                        key={String(choice)}
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelect(question.id, index, choice)}
                        className={cn(
                          'mx-auto flex h-6 w-6 items-center justify-center rounded-full border',
                          value === choice
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/40 bg-background'
                        )}
                        aria-label={`Câu ${qIndex + 1}${label} ${choice ? 'đúng' : 'sai'}`}
                      />
                    ))}
                    {index === 0 ? <ResultIcon answer={answer} /> : <span />}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShortSheet({
  questions,
  texts,
  disabled,
  result,
  onChange,
}: {
  questions: PracticeTestQuestion[];
  texts: Record<string, string>;
  disabled: boolean;
  result: Result | null;
  onChange: (questionId: string, value: string) => void;
}) {
  if (questions.length === 0) return null;
  return (
    <div className="space-y-3">
      <SectionTitle title="Trả lời ngắn" />
      <div className="space-y-3">
        {questions.map((question, qIndex) => {
          const answer = answerFor(result, question.id);
          return (
            <label key={question.id} className="block space-y-1.5">
              <span className="flex items-center justify-between text-sm font-semibold">
                Câu {qIndex + 1}
                <ResultIcon answer={answer} />
              </span>
              <input
                value={texts[question.id] ?? ''}
                onChange={(e) => onChange(question.id, e.target.value)}
                disabled={disabled}
                className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none disabled:opacity-70"
                placeholder="Nhập đáp án ngắn..."
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="text-muted-foreground text-xs font-bold tracking-wide uppercase">{title}</h3>
  );
}
