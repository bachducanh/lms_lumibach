'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ExternalLink,
  Trash2,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import type { AttemptDetailRow, QuizQuestionBrief } from '@lumibach/types';

// ── Constants ─────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────

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

function fmtDuration(startedAt: Date | string, submittedAt: Date | string | null): string {
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

function durSecs(a: AttemptDetailRow): number {
  if (!a.submittedAt) return Infinity;
  return new Date(a.submittedAt).getTime() - new Date(a.startedAt).getTime();
}

function normalizeScore(score: number | null, maxScore: number | null): string {
  if (score === null || !maxScore) return '—';
  return ((score / maxScore) * 10).toFixed(2);
}

// ── CSV export ────────────────────────────────────────────────

function exportCSV(rows: AttemptDetailRow[], questions: QuizQuestionBrief[], quizTitle: string) {
  const headers = [
    'Họ và tên',
    'Email',
    'Trạng thái',
    'Bắt đầu vào lúc',
    'Được hoàn thành',
    'Thời gian thực hiện',
    'Điểm/10',
    ...questions.map((q, i) => `Q${i + 1}/${q.points}`),
  ];

  const csvRows = rows.map((a) => {
    const name =
      (a.student?.fullName ??
        `${a.student?.firstName ?? ''} ${a.student?.lastName ?? ''}`.trim()) ||
      'Học sinh';
    const ansMap = new Map(a.answers.map((ans) => [ans.questionId, ans]));
    return [
      name,
      a.student?.email ?? '',
      STATUS_LABEL[a.status] ?? a.status,
      fmt(a.startedAt),
      fmt(a.submittedAt),
      fmtDuration(a.startedAt, a.submittedAt),
      normalizeScore(a.score, a.maxScore),
      ...questions.map((q) => {
        const ans = ansMap.get(q.questionId);
        return ans?.score != null ? String(ans.score) : '';
      }),
    ];
  });

  const csv = [headers, ...csvRows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  // UTF-8 BOM so Excel opens Vietnamese correctly
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bai-lam-${quizTitle.toLowerCase().replace(/\s+/g, '-')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Types ─────────────────────────────────────────────────────

type SortKey = 'startedAt' | 'submittedAt' | 'duration' | 'score';
type SortDir = 'asc' | 'desc';

type Props = {
  attempts: AttemptDetailRow[];
  questions: QuizQuestionBrief[];
  quizId: string;
  quizTitle: string;
  courseSlug: string;
};

// ── Component ─────────────────────────────────────────────────

export function AttemptsTable({ attempts, questions, quizId, quizTitle, courseSlug }: Props) {
  const router = useRouter();
  const [deletePending, startDelete] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return attempts;
    return [...attempts].sort((a, b) => {
      let va: number, vb: number;
      if (sortKey === 'startedAt') {
        va = new Date(a.startedAt).getTime();
        vb = new Date(b.startedAt).getTime();
      } else if (sortKey === 'submittedAt') {
        va = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        vb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      } else if (sortKey === 'duration') {
        va = durSecs(a);
        vb = durSecs(b);
      } else {
        va = a.score ?? -1;
        vb = b.score ?? -1;
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [attempts, sortKey, sortDir]);

  function toggleSelectAll() {
    setSelected(selected.size === sorted.length ? new Set() : new Set(sorted.map((a) => a.id)));
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDelete() {
    const ids = [...selected];
    startDelete(async () => {
      try {
        await apiClient.delete('/attempts', { body: { ids } });
        toast.success('Đã xoá bài làm.');
        setSelected(new Set());
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
      }
    });
  }

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

  const allSelected = sorted.length > 0 && selected.size === sorted.length;
  const selectedCount = selected.size;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: selection action */}
        <div className="flex min-h-8 items-center gap-2">
          {selectedCount > 0 && (
            <>
              <span className="text-muted-foreground text-sm">{selectedCount} đã chọn</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deletePending}
                className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deletePending ? 'Đang xoá...' : `Xoá ${selectedCount} bài làm`}
              </button>
            </>
          )}
        </div>

        {/* Right: export */}
        <button
          type="button"
          onClick={() => exportCSV(sorted, questions, quizTitle)}
          className="border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Xuất CSV
        </button>
      </div>

      {/* Table */}
      <div className="border-border overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border bg-muted/50 border-b">
              <th className="w-10 px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="border-input accent-primary h-4 w-4 cursor-pointer rounded"
                />
              </th>

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

              {questions.map((q, idx) => (
                <th
                  key={q.questionId}
                  className="text-muted-foreground min-w-14 px-3 py-2.5 text-center text-xs font-semibold tracking-wide whitespace-nowrap uppercase"
                >
                  Q{idx + 1}/{q.points % 1 === 0 ? q.points : q.points.toFixed(2)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-border divide-y">
            {sorted.map((a) => {
              const name =
                (a.student?.fullName ??
                  `${a.student?.firstName ?? ''} ${a.student?.lastName ?? ''}`.trim()) ||
                'Học sinh';
              const ansMap = new Map(a.answers.map((ans) => [ans.questionId, ans]));
              const score10 = normalizeScore(a.score, a.maxScore);

              return (
                <tr
                  key={a.id}
                  className={cn(
                    'hover:bg-muted/30 transition-colors',
                    selected.has(a.id) && 'bg-primary/5'
                  )}
                >
                  <td className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggleSelect(a.id)}
                      className="border-input accent-primary h-4 w-4 cursor-pointer rounded"
                    />
                  </td>

                  <td className="px-3 py-3">
                    <p className="leading-snug font-medium">{name}</p>
                    <Link
                      href={`/courses/${courseSlug}/quizzes/${quizId}/attempt/${a.id}`}
                      className="text-primary mt-0.5 inline-flex items-center gap-1 text-xs hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Xem bài làm
                    </Link>
                  </td>

                  <td className="text-muted-foreground px-3 py-3 text-xs">
                    {a.student?.email ?? '—'}
                  </td>

                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium',
                        STATUS_CLASS[a.status] ?? 'bg-muted text-muted-foreground'
                      )}
                    >
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </td>

                  <td className="text-muted-foreground px-3 py-3 text-xs whitespace-nowrap">
                    {fmt(a.startedAt)}
                  </td>
                  <td className="text-muted-foreground px-3 py-3 text-xs whitespace-nowrap">
                    {fmt(a.submittedAt)}
                  </td>
                  <td className="text-muted-foreground px-3 py-3 text-xs whitespace-nowrap">
                    {fmtDuration(a.startedAt, a.submittedAt)}
                  </td>

                  {/* Score normalized to /10 */}
                  <td className="px-3 py-3 text-center font-semibold tabular-nums">{score10}</td>

                  {questions.map((q) => {
                    const ans = ansMap.get(q.questionId);
                    return (
                      <td key={q.questionId} className="px-3 py-3 text-center tabular-nums">
                        {ans?.score != null ? (
                          <span
                            className={cn(
                              'text-xs font-medium',
                              ans.isCorrect === true && 'text-green-600 dark:text-green-400',
                              ans.isCorrect === false && 'text-destructive'
                            )}
                          >
                            {ans.score}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">—</span>
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
            Chưa có bài làm nào.
          </div>
        )}
      </div>
    </div>
  );
}
