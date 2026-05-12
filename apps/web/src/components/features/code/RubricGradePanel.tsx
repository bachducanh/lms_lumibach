'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  gradeCodeSubmissionWithRubricAction,
  getCodeSubmissionRubricGradesAction,
  type RubricData,
} from '@/actions/rubric';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

type Props = {
  rubric: RubricData;
  codeSubmissionId: string;
  /** Cap on total score; matches the exercise/Scratch grading scale (default 10). */
  maxScore?: number;
  onGraded?: (score: number) => void;
};

/**
 * Side-panel for grading a Code/Scratch submission against the exercise's rubric.
 * Renders one row per criterion, levels as click-to-select pills, and a live total.
 * Pre-loads any previous selections so re-grading is non-destructive.
 */
export function RubricGradePanel({ rubric, codeSubmissionId, maxScore = 10, onGraded }: Props) {
  // selections: criterionId -> levelId
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  // Load existing grades once
  useEffect(() => {
    let cancelled = false;
    getCodeSubmissionRubricGradesAction(codeSubmissionId).then((rows) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const r of rows) next[r.criterionId] = r.levelId;
      setSelections(next);
    });
    return () => {
      cancelled = true;
    };
  }, [codeSubmissionId]);

  // Live total: sum of selected level points, capped by maxScore
  const total = useMemo(() => {
    let sum = 0;
    for (const c of rubric.criteria) {
      const levelId = selections[c.id];
      if (!levelId) continue;
      const lv = c.levels.find((l) => l.id === levelId);
      if (lv) sum += lv.points;
    }
    return Math.min(sum, maxScore);
  }, [rubric, selections, maxScore]);

  const allChosen = rubric.criteria.every((c) => !!selections[c.id]);
  const rubricMax = rubric.criteria.reduce(
    (s, c) => s + Math.max(0, ...c.levels.map((l) => l.points)),
    0
  );

  function handleSubmit() {
    if (!allChosen) {
      toast.error('Hãy chọn mức cho mọi tiêu chí trước khi chấm.');
      return;
    }
    const sel = rubric.criteria.map((c) => ({ criterionId: c.id, levelId: selections[c.id]! }));
    startTransition(async () => {
      const res = await gradeCodeSubmissionWithRubricAction(codeSubmissionId, sel, maxScore);
      if (res.success) {
        toast.success(res.message);
        onGraded?.(res.data?.score ?? total);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="border-border/60 bg-card/40 space-y-4 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary h-4 w-4" />
          <h3 className="text-sm font-semibold">Chấm theo rubric</h3>
        </div>
        <div className="text-muted-foreground text-xs">
          Tổng <span className="text-foreground font-bold tabular-nums">{total}</span>
          <span className="text-muted-foreground"> / {Math.min(rubricMax, maxScore)}</span>
        </div>
      </div>

      <ul className="space-y-3">
        {rubric.criteria.map((c) => {
          const chosen = selections[c.id];
          const max = Math.max(0, ...c.levels.map((l) => l.points));
          return (
            <li
              key={c.id}
              className="border-border/60 bg-background/60 space-y-2 rounded-lg border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{c.name}</p>
                <span className="text-muted-foreground shrink-0 text-[11px]">tối đa {max} đ</span>
              </div>
              {c.description && <p className="text-muted-foreground text-xs">{c.description}</p>}
              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${Math.min(c.levels.length, 4)}, 1fr)` }}
              >
                {c.levels.map((l) => {
                  const active = chosen === l.id;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSelections((s) => ({ ...s, [c.id]: l.id }))}
                      className={cn(
                        'rounded-md border px-2 py-1.5 text-left transition-all',
                        active
                          ? 'border-primary/60 bg-primary/10 ring-primary/40 ring-1'
                          : 'border-border bg-muted/20 hover:bg-muted/40'
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <p className="truncate text-xs font-semibold">{l.label}</p>
                        <span
                          className={cn(
                            'shrink-0 text-[11px] tabular-nums',
                            active ? 'text-primary font-bold' : 'text-muted-foreground'
                          )}
                        >
                          {l.points}đ
                        </span>
                      </div>
                      {l.description && (
                        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[10px] leading-snug">
                          {l.description}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSubmit} disabled={pending || !allChosen}>
          {pending ? 'Đang lưu...' : `Chấm ${total} điểm`}
        </Button>
      </div>
    </div>
  );
}
