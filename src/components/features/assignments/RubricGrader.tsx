'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { gradeWithRubricAction, type RubricData } from '@/actions/rubric';
import { cn } from '@/lib/utils';

type Props = {
  submissionId:    string;
  maxScore:        number;
  rubric:          RubricData;
  initialGrades:   { criterionId: string; levelId: string }[];
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
  const allGraded   = gradedCount === rubric.criteria.length;

  function handleSave() {
    if (gradedCount === 0) {
      toast.error('Chọn ít nhất 1 mức độ để chấm.');
      return;
    }
    const sel = Object.entries(selections).map(([criterionId, levelId]) => ({ criterionId, levelId }));
    startTransition(async () => {
      const res = await gradeWithRubricAction(submissionId, sel);
      if (res.success) { toast.success(res.message); router.refresh(); }
      else toast.error(res.error);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
        <p className="text-sm font-semibold">Chấm theo rubric</p>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{gradedCount}/{rubric.criteria.length} tiêu chí</span>
          <span className={cn(
            'font-bold text-lg tabular-nums',
            total > maxScore ? 'text-destructive' : allGraded ? 'text-green-600 dark:text-green-400' : '',
          )}>
            {total}
            <span className="text-sm font-normal text-muted-foreground">/{maxScore}</span>
          </span>
        </div>
      </div>

      <div className="divide-y divide-border">
        {rubric.criteria.map((c) => {
          const selectedId = selections[c.id];

          return (
            <div key={c.id} className="px-5 py-4 space-y-2">
              <div>
                <p className="text-sm font-medium">{c.name}</p>
                {c.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
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
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                          : 'border-border bg-background text-muted-foreground',
                      )}
                    >
                      <span className="font-semibold block">{l.label}</span>
                      <span className="text-[11px] opacity-80">{l.points} điểm</span>
                      {l.description && (
                        <span className="block mt-1 text-[11px] leading-relaxed max-w-[160px]">{l.description}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
        {!allGraded && (
          <p className="text-xs text-muted-foreground">
            Còn {rubric.criteria.length - gradedCount} tiêu chí chưa chấm
          </p>
        )}
        {allGraded && (
          <p className="text-xs text-green-600 dark:text-green-400 font-medium">
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
