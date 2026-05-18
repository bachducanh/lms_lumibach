'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import type { RubricData } from '@lumibach/types';
import { cn } from '@/lib/utils';

type Props = {
  submissionId: string;
  maxScore: number;
  rubric: RubricData;
  initialGrades: { criterionId: string; levelId: string }[];
};

export function RubricGrader({ submissionId, maxScore, rubric, initialGrades }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const g of initialGrades) map[g.criterionId] = g.levelId;
    return map;
  });

  function select(criterionId: string, levelId: string) {
    setSelections((prev) => {
      // Toggle off if already selected
      if (prev[criterionId] === levelId) {
        const next = { ...prev };
        delete next[criterionId];
        return next;
      }
      return { ...prev, [criterionId]: levelId };
    });
  }

  // Running total
  const total = rubric.criteria.reduce((sum, c) => {
    const selectedLevelId = selections[c.id];
    if (!selectedLevelId) return sum;
    const level = c.levels.find((l) => l.id === selectedLevelId);
    return sum + (level?.points ?? 0);
  }, 0);

  const gradedCount = Object.keys(selections).length;
  const allGraded = gradedCount === rubric.criteria.length;

  function handleSave() {
    if (gradedCount === 0) {
      toast.error('Chọn ít nhất 1 mức độ để chấm.');
      return;
    }
    const sel = Object.entries(selections).map(([criterionId, levelId]) => ({
      criterionId,
      levelId,
    }));
    startTransition(async () => {
      try {
        await apiClient.post(`/rubrics/grade/submission/${submissionId}`, { selections: sel });
        toast.success('Đã lưu điểm rubric.');
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
      }
    });
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="border-border bg-muted/30 flex items-center justify-between border-b px-5 py-3">
        <p className="text-sm font-semibold">Chấm theo rubric</p>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            {gradedCount}/{rubric.criteria.length} tiêu chí
          </span>
          <span
            className={cn(
              'text-lg font-bold tabular-nums',
              total > maxScore
                ? 'text-destructive'
                : allGraded
                  ? 'text-green-600 dark:text-green-400'
                  : ''
            )}
          >
            {total}
            <span className="text-muted-foreground text-sm font-normal">/{maxScore}</span>
          </span>
        </div>
      </div>

      <div className="divide-border divide-y">
        {rubric.criteria.map((c) => {
          const selectedId = selections[c.id];

          return (
            <div key={c.id} className="space-y-2 px-5 py-4">
              <div>
                <p className="text-sm font-medium">{c.name}</p>
                {c.description && (
                  <p className="text-muted-foreground mt-0.5 text-xs">{c.description}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {c.levels.map((l) => {
                  const isSelected = selectedId === l.id;
                  return (
                    <button
                      key={l.id}
                      onClick={() => select(c.id, l.id)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-left text-xs transition-all',
                        'hover:border-primary/50 hover:bg-primary/5',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary ring-primary/30 ring-1'
                          : 'border-border bg-background text-muted-foreground'
                      )}
                    >
                      <span className="block font-semibold">{l.label}</span>
                      <span className="text-[11px] opacity-80">{l.points} điểm</span>
                      {l.description && (
                        <span className="mt-1 block max-w-[160px] text-[11px] leading-relaxed">
                          {l.description}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-border bg-muted/20 flex items-center justify-between border-t px-5 py-3">
        {!allGraded && (
          <p className="text-muted-foreground text-xs">
            Còn {rubric.criteria.length - gradedCount} tiêu chí chưa chấm
          </p>
        )}
        {allGraded && (
          <p className="text-xs font-medium text-green-600 dark:text-green-400">
            Đã chọn đủ {rubric.criteria.length} tiêu chí
          </p>
        )}
        <Button size="sm" onClick={handleSave} disabled={pending || gradedCount === 0}>
          {pending ? 'Đang lưu...' : `Lưu điểm · ${Math.min(total, maxScore)} điểm`}
        </Button>
      </div>
    </div>
  );
}
