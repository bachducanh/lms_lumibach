'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ChevronsUpDown, Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { exportRowsToExcel, safeExcelFileName } from '@/lib/export-excel';
import { numberBySection } from '@/lib/practice-test-utils';
import { cn } from '@/lib/utils';
import type { PracticeAttemptListItem, PracticeTestQuestion } from '@lumibach/types';

const TF_LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'Đang làm',
  SUBMITTED: 'Chưa hoàn thành',
  GRADED: 'Hoàn thành',
};

const STATUS_CLASS: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  SUBMITTED: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  GRADED: 'bg-green-500/10 text-green-700 dark:text-green-400',
};

type PracticeAttemptAnswer = NonNullable<PracticeAttemptListItem['answers']>[number];

type SortKey = 'startedAt' | 'submittedAt' | 'duration' | 'score';
type SortDir = 'asc' | 'desc';

type QuestionColumn =
  | {
      key: string;
      kind: 'score';
      questionId: string;
      label: string;
    }
  | {
      key: string;
      kind: 'tf-statement';
      questionId: string;
      label: string;
      statementIndex: number;
      correctValue: boolean | null;
    };

type Props = {
  attempts: PracticeAttemptListItem[];
  questions: PracticeTestQuestion[];
  practiceTestId: string;
  practiceTestTitle: string;
  courseSlug: string;
};

function fmt(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));
}

function fmtDuration(
  startedAt: Date | string,
  submittedAt: Date | string | null | undefined
): string {
  if (!submittedAt) return '—';
  const secs = Math.max(
    0,
    Math.floor((new Date(submittedAt).getTime() - new Date(startedAt).getTime()) / 1000)
  );
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  return `${m}p ${String(s).padStart(2, '0')}s`;
}

function durMs(attempt: PracticeAttemptListItem): number {
  if (!attempt.submittedAt) return Infinity;
  return new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime();
}

function normalizeScore(score: number | null, maxScore: number | null): string {
  if (score === null || !maxScore) return '—';
  return ((score / maxScore) * 10).toFixed(2);
}

function formatPoints(points: number): string {
  return points.toFixed(2).replace(/\.?0+$/, '');
}

function formatScore(score: number | null | undefined): string {
  if (score == null) return '—';
  return formatPoints(score);
}

function studentName(student: PracticeAttemptListItem['student']): string {
  const fallback = `${student?.firstName ?? ''} ${student?.lastName ?? ''}`.trim();
  return student?.fullName || fallback || 'Học sinh';
}

function correctStatements(question: PracticeTestQuestion): boolean[] {
  const correct = question.correctAnswer;
  if (correct && 'statements' in correct && Array.isArray(correct.statements)) {
    return correct.statements.map(Boolean);
  }
  return [];
}

function buildColumns(questions: PracticeTestQuestion[]): QuestionColumn[] {
  const sectionNumbers = numberBySection(questions);
  return questions.flatMap((question) => {
    const questionNumber = sectionNumbers.get(question.id) ?? question.position + 1;
    const scoreColumn: QuestionColumn = {
      key: `${question.id}:score`,
      kind: 'score',
      questionId: question.id,
      label: `Q${questionNumber}/${formatPoints(question.points)}`,
    };

    if (question.type !== 'TRUE_FALSE_MULTI') return [scoreColumn];

    const statements = correctStatements(question);
    const statementColumns = Array.from(
      { length: question.statementCount },
      (_, statementIndex): QuestionColumn => ({
        key: `${question.id}:tf:${statementIndex}`,
        kind: 'tf-statement',
        questionId: question.id,
        label: `Q${questionNumber}${TF_LABELS[statementIndex] ?? statementIndex + 1}`,
        statementIndex,
        correctValue:
          typeof statements[statementIndex] === 'boolean' ? statements[statementIndex]! : null,
      })
    );

    return [scoreColumn, ...statementColumns];
  });
}

function statementResult(
  column: Extract<QuestionColumn, { kind: 'tf-statement' }>,
  answer?: PracticeAttemptAnswer
) {
  const selected = answer?.statementAnswers?.[column.statementIndex];
  if (typeof selected !== 'boolean' || typeof column.correctValue !== 'boolean') return null;
  return selected === column.correctValue;
}

function exportCellValue(column: QuestionColumn, answer?: PracticeAttemptAnswer) {
  if (column.kind === 'score') return answer?.score ?? '';
  const result = statementResult(column, answer);
  if (result === null) return '';
  return result ? 'Đúng' : 'Sai';
}

async function exportPracticeAttempts(
  rows: PracticeAttemptListItem[],
  columns: QuestionColumn[],
  practiceTestTitle: string
) {
  const headers = [
    'Họ và tên',
    'Email',
    'Trạng thái',
    'Bắt đầu vào lúc',
    'Được hoàn thành',
    'Thời gian thực hiện',
    'Điểm/10,00',
    ...columns.map((column) => column.label),
  ];

  const bodyRows = rows.map((attempt) => {
    const ansMap = new Map<string, PracticeAttemptAnswer>(
      (attempt.answers ?? []).map((answer) => [answer.questionId, answer])
    );

    return [
      studentName(attempt.student),
      attempt.student?.email ?? '',
      STATUS_LABEL[attempt.status] ?? attempt.status,
      fmt(attempt.startedAt),
      fmt(attempt.submittedAt),
      fmtDuration(attempt.startedAt, attempt.submittedAt),
      normalizeScore(attempt.score, attempt.maxScore),
      ...columns.map((column) => exportCellValue(column, ansMap.get(column.questionId))),
    ];
  });

  await exportRowsToExcel({
    rows: [headers, ...bodyRows],
    fileName: `bai-lam-de-luyen-tap-${safeExcelFileName(practiceTestTitle)}.xlsx`,
    sheetName: 'Bai lam de PDF',
  });
}

export function PracticeAttemptsTable({
  attempts,
  questions,
  practiceTestId,
  practiceTestTitle,
  courseSlug,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const columns = useMemo(() => buildColumns(questions), [questions]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return attempts;
    return [...attempts].sort((a, b) => {
      let va: number;
      let vb: number;

      if (sortKey === 'startedAt') {
        va = new Date(a.startedAt).getTime();
        vb = new Date(b.startedAt).getTime();
      } else if (sortKey === 'submittedAt') {
        va = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        vb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      } else if (sortKey === 'duration') {
        va = durMs(a);
        vb = durMs(b);
      } else {
        va = a.score ?? -1;
        vb = b.score ?? -1;
      }

      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [attempts, sortDir, sortKey]);

  function sortIcon(col: SortKey) {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  }

  function sortTh(col: SortKey, label: string) {
    return (
      <th className="px-3 py-2.5 text-left whitespace-nowrap">
        <button
          type="button"
          onClick={() => toggleSort(col)}
          className={cn(
            'flex items-center gap-1 text-xs font-semibold tracking-wide uppercase transition-colors',
            sortKey === col ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {label}
          {sortIcon(col)}
        </button>
      </th>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => {
            void exportPracticeAttempts(sorted, columns, practiceTestTitle).catch((error) => {
              toast.error(error instanceof Error ? error.message : 'Không thể xuất Excel.');
            });
          }}
          className="border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Xuất Excel
        </button>
      </div>

      <div className="border-border overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border bg-muted/50 border-b">
              <th className="text-muted-foreground min-w-48 px-3 py-2.5 text-left text-xs font-semibold tracking-wide uppercase">
                Họ và tên
              </th>
              <th className="text-muted-foreground min-w-44 px-3 py-2.5 text-left text-xs font-semibold tracking-wide uppercase">
                Email
              </th>
              <th className="text-muted-foreground min-w-36 px-3 py-2.5 text-left text-xs font-semibold tracking-wide uppercase">
                Trạng thái
              </th>

              {sortTh('startedAt', 'Bắt đầu vào lúc')}
              {sortTh('submittedAt', 'Được hoàn thành')}
              {sortTh('duration', 'Thời gian thực hiện')}
              {sortTh('score', 'Điểm/10,00')}

              {columns.map((column) => (
                <th
                  key={column.key}
                  className="text-muted-foreground min-w-14 px-3 py-2.5 text-center text-xs font-semibold tracking-wide whitespace-nowrap uppercase"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-border divide-y">
            {sorted.map((attempt) => {
              const ansMap = new Map<string, PracticeAttemptAnswer>(
                (attempt.answers ?? []).map((answer) => [answer.questionId, answer])
              );
              const score10 = normalizeScore(attempt.score, attempt.maxScore);

              return (
                <tr key={attempt.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-3">
                    <p className="leading-snug font-medium">{studentName(attempt.student)}</p>
                    <Link
                      href={`/courses/${courseSlug}/practice-tests/${practiceTestId}/attempt/${attempt.id}`}
                      className="text-primary mt-0.5 inline-flex items-center gap-1 text-xs hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Xem bài làm
                    </Link>
                  </td>

                  <td className="text-muted-foreground px-3 py-3 text-xs">
                    {attempt.student?.email ?? '—'}
                  </td>

                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium',
                        STATUS_CLASS[attempt.status] ?? 'bg-muted text-muted-foreground'
                      )}
                    >
                      {STATUS_LABEL[attempt.status] ?? attempt.status}
                    </span>
                  </td>

                  <td className="text-muted-foreground px-3 py-3 text-xs whitespace-nowrap">
                    {fmt(attempt.startedAt)}
                  </td>
                  <td className="text-muted-foreground px-3 py-3 text-xs whitespace-nowrap">
                    {fmt(attempt.submittedAt)}
                  </td>
                  <td className="text-muted-foreground px-3 py-3 text-xs whitespace-nowrap">
                    {fmtDuration(attempt.startedAt, attempt.submittedAt)}
                  </td>
                  <td className="px-3 py-3 text-center font-semibold tabular-nums">{score10}</td>

                  {columns.map((column) => {
                    const answer = ansMap.get(column.questionId);
                    if (column.kind === 'score') {
                      return (
                        <td key={column.key} className="px-3 py-3 text-center tabular-nums">
                          <span
                            className={cn(
                              'text-xs font-medium',
                              answer?.isCorrect === true && 'text-green-600 dark:text-green-400',
                              answer?.isCorrect === false && 'text-destructive'
                            )}
                          >
                            {formatScore(answer?.score)}
                          </span>
                        </td>
                      );
                    }

                    const result = statementResult(column, answer);
                    return (
                      <td key={column.key} className="px-3 py-3 text-center">
                        {result === null ? (
                          <span className="text-muted-foreground/50 text-xs">—</span>
                        ) : (
                          <span
                            className={cn(
                              'text-xs font-semibold',
                              result ? 'text-green-600 dark:text-green-400' : 'text-destructive'
                            )}
                          >
                            {result ? 'Đúng' : 'Sai'}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div className="text-muted-foreground py-16 text-center text-sm">
            Chưa có học sinh nộp bài.
          </div>
        )}
      </div>
    </div>
  );
}
