'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Download, ChevronUp, ChevronDown } from 'lucide-react';
import type { GbColumn, GbStudent } from '@lumibach/types';

function pct(score: number | null, max: number) {
  if (score === null || max === 0) return null;
  return Math.round((score / max) * 100);
}

function cellColor(p: number | null) {
  if (p === null) return '';
  if (p >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (p >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function avg(student: GbStudent, columns: GbColumn[]): number | null {
  let totalScore = 0,
    totalMax = 0;
  for (const col of columns) {
    const cell = student.scores[col.id];
    if (cell?.score != null && cell.maxScore > 0) {
      totalScore += cell.score;
      totalMax += cell.maxScore;
    }
  }
  return totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null;
}

function exportCsv(columns: GbColumn[], students: GbStudent[]) {
  const header = ['Học sinh', 'Email', ...columns.map((c) => c.title), 'Trung bình (%)'];
  const rows = students.map((s) => [
    s.name,
    s.email,
    ...columns.map((c) => {
      const cell = s.scores[c.id];
      if (!cell || cell.score === null) return '';
      return `${cell.score}/${cell.maxScore}`;
    }),
    avg(s, columns) ?? '',
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bang-diem.csv';
  a.click();
  URL.revokeObjectURL(url);
}

type SortKey = 'name' | string; // columnId or 'name'
type SortDir = 'asc' | 'desc';

type Props = {
  columns: GbColumn[];
  students: GbStudent[];
};

export function GradebookTable({ columns, students }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    return [...students].sort((a, b) => {
      let va: number | string | null, vb: number | string | null;
      if (sortKey === 'name') {
        va = a.name;
        vb = b.name;
      } else if (sortKey === '__avg') {
        va = avg(a, columns);
        vb = avg(b, columns);
        va = va ?? -1;
        vb = vb ?? -1;
      } else {
        va = a.scores[sortKey]?.score ?? -1;
        vb = b.scores[sortKey]?.score ?? -1;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [students, sortKey, sortDir, columns]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp className="h-3 w-3 opacity-20" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3 w-3 opacity-70" />
    ) : (
      <ChevronDown className="h-3 w-3 opacity-70" />
    );
  }

  const classAvg = useMemo(() => {
    const vals = sorted.map((s) => avg(s, columns)).filter((v): v is number => v !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [sorted, columns]);

  if (students.length === 0) {
    return (
      <div className="border-border bg-muted/30 flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
        <p className="text-muted-foreground text-sm">Chưa có học sinh nào đã hoàn thành bài.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">
          {sorted.length} học sinh · {columns.length} cột đánh giá
          {classAvg !== null && (
            <span className="text-foreground ml-2 font-medium">
              · TB lớp: <span className={cellColor(classAvg)}>{classAvg}%</span>
            </span>
          )}
        </p>
        <button
          onClick={() => exportCsv(columns, students)}
          className="border-border bg-card hover:bg-accent/50 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Xuất CSV
        </button>
      </div>

      <div className="border-border overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-border bg-muted/30 border-b">
              {/* Sticky student name column */}
              <th
                className="bg-muted/60 text-muted-foreground sticky left-0 z-10 min-w-[180px] cursor-pointer px-4 py-3 text-left text-xs font-semibold whitespace-nowrap backdrop-blur-sm select-none"
                onClick={() => toggleSort('name')}
              >
                <span className="flex items-center gap-1">
                  Học sinh <SortIcon col="name" />
                </span>
              </th>

              {columns.map((col) => (
                <th
                  key={col.id}
                  className="text-muted-foreground min-w-[110px] cursor-pointer px-3 py-3 text-center text-xs font-semibold whitespace-nowrap select-none"
                  onClick={() => toggleSort(col.id)}
                >
                  <span className="flex flex-col items-center gap-0.5">
                    <span className="flex items-center gap-1">
                      <span
                        className={cn(
                          'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
                          col.type === 'QUIZ' ? 'bg-violet-500' : 'bg-primary'
                        )}
                      />
                      <SortIcon col={col.id} />
                    </span>
                    <span className="line-clamp-2 max-w-[100px] leading-tight">{col.title}</span>
                    <span className="text-[10px] font-normal opacity-60">/{col.maxScore}đ</span>
                  </span>
                </th>
              ))}

              <th
                className="text-muted-foreground min-w-[80px] cursor-pointer px-3 py-3 text-center text-xs font-semibold whitespace-nowrap select-none"
                onClick={() => toggleSort('__avg')}
              >
                <span className="flex items-center justify-center gap-1">
                  TB% <SortIcon col="__avg" />
                </span>
              </th>
            </tr>
          </thead>

          <tbody>
            {sorted.map((student, ri) => {
              const a = avg(student, columns);
              return (
                <tr
                  key={student.id}
                  className={cn(
                    'border-border/50 hover:bg-accent/20 border-b transition-colors',
                    ri % 2 === 0 ? 'bg-card' : 'bg-muted/10'
                  )}
                >
                  {/* Sticky name cell */}
                  <td
                    className={cn(
                      'sticky left-0 z-10 min-w-[180px] px-4 py-2.5 backdrop-blur-sm',
                      ri % 2 === 0 ? 'bg-card' : 'bg-muted/10'
                    )}
                  >
                    <p className="max-w-[160px] truncate text-sm font-medium">{student.name}</p>
                    <p className="text-muted-foreground max-w-[160px] truncate text-[10px]">
                      {student.email}
                    </p>
                  </td>

                  {columns.map((col) => {
                    const cell = student.scores[col.id] ?? null;
                    const p = cell ? pct(cell.score, cell.maxScore) : null;
                    return (
                      <td key={col.id} className="px-3 py-2.5 text-center">
                        {!cell ? (
                          <span className="text-muted-foreground/30 text-xs">—</span>
                        ) : cell.score === null ? (
                          <span className="text-xs text-amber-500">Chờ chấm</span>
                        ) : (
                          <span className={cn('font-mono text-xs font-semibold', cellColor(p))}>
                            {cell.score}
                            <span className="text-muted-foreground font-normal">
                              /{cell.maxScore}
                            </span>
                          </span>
                        )}
                      </td>
                    );
                  })}

                  <td className="px-3 py-2.5 text-center">
                    {a !== null ? (
                      <span className={cn('text-xs font-bold', cellColor(a))}>{a}%</span>
                    ) : (
                      <span className="text-muted-foreground/30 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="text-muted-foreground flex flex-wrap gap-3 px-1 text-[10px]">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> ≥ 80%
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> 60–79%
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500" /> &lt; 60%
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-violet-500" /> Quiz
        </span>
        <span className="flex items-center gap-1">
          <span className="bg-primary h-2 w-2 rounded-full" /> Bài tập
        </span>
      </div>
    </div>
  );
}
