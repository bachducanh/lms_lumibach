'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { saveRubricAction, deleteRubricAction, type RubricData } from '@/actions/rubric';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { cn } from '@/lib/utils';

type Level = { label: string; points: string; description: string };
type Criterion = { name: string; description: string; levels: Level[] };

function emptyLevel(position: number): Level {
  const defaults = ['Xuất sắc', 'Tốt', 'Đạt', 'Chưa đạt'];
  return { label: defaults[position] ?? `Mức ${position + 1}`, points: '', description: '' };
}

function emptyLevelPoints(criterionIdx: number, levelIdx: number, maxScore: number, totalCriteria: number): string {
  // Auto-suggest descending points
  const perCriterion = totalCriteria > 0 ? Math.round(maxScore / totalCriteria) : maxScore;
  const steps = 4;
  const points = Math.round(perCriterion * (steps - levelIdx) / steps);
  return String(Math.max(0, points));
}

function fromRubricData(data: RubricData | null): Criterion[] {
  if (!data) return [];
  return data.criteria.map((c) => ({
    name:        c.name,
    description: c.description ?? '',
    levels:      c.levels.map((l) => ({ label: l.label, points: String(l.points), description: l.description ?? '' })),
  }));
}

type Props = {
  assignmentId: string;
  maxScore:     number;
  initialRubric: RubricData | null;
};

export function RubricBuilder({ assignmentId, maxScore, initialRubric }: Props) {
  const [criteria, setCriteria] = useState<Criterion[]>(() => fromRubricData(initialRubric));
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [pending, startTransition] = useTransition();
  const [confirmDialog, openConfirm] = useConfirmDialog();

  const hasRubric = !!initialRubric;

  function addCriterion() {
    const idx = criteria.length;
    setCriteria((prev) => [
      ...prev,
      {
        name: `Tiêu chí ${idx + 1}`,
        description: '',
        levels: [0, 1, 2, 3].map((i) => ({
          ...emptyLevel(i),
          points: emptyLevelPoints(idx, i, maxScore, prev.length + 1),
        })),
      },
    ]);
    setExpanded((e) => ({ ...e, [idx]: true }));
  }

  function removeCriterion(idx: number) {
    setCriteria((prev) => prev.filter((_, i) => i !== idx));
    setExpanded((e) => {
      const next: Record<number, boolean> = {};
      Object.entries(e).forEach(([k, v]) => {
        const n = Number(k);
        if (n < idx) next[n] = v;
        else if (n > idx) next[n - 1] = v;
      });
      return next;
    });
  }

  function updateCriterion(idx: number, field: 'name' | 'description', val: string) {
    setCriteria((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  }

  function addLevel(cIdx: number) {
    setCriteria((prev) => prev.map((c, i) => {
      if (i !== cIdx) return c;
      return { ...c, levels: [...c.levels, { ...emptyLevel(c.levels.length), points: '0' }] };
    }));
  }

  function removeLevel(cIdx: number, lIdx: number) {
    setCriteria((prev) => prev.map((c, i) => {
      if (i !== cIdx) return c;
      return { ...c, levels: c.levels.filter((_, j) => j !== lIdx) };
    }));
  }

  function updateLevel(cIdx: number, lIdx: number, field: keyof Level, val: string) {
    setCriteria((prev) => prev.map((c, i) => {
      if (i !== cIdx) return c;
      return { ...c, levels: c.levels.map((l, j) => j === lIdx ? { ...l, [field]: val } : l) };
    }));
  }

  function handleSave() {
    if (criteria.length === 0) {
      toast.error('Rubric cần ít nhất 1 tiêu chí.');
      return;
    }
    for (const c of criteria) {
      if (!c.name.trim()) { toast.error('Tiêu chí cần có tên.'); return; }
      if (c.levels.length === 0) { toast.error(`Tiêu chí "${c.name}" cần ít nhất 1 mức độ.`); return; }
      for (const l of c.levels) {
        if (!l.label.trim()) { toast.error('Mỗi mức độ cần có nhãn.'); return; }
        if (l.points === '' || isNaN(Number(l.points))) { toast.error('Điểm của mỗi mức độ phải là số.'); return; }
      }
    }

    startTransition(async () => {
      const res = await saveRubricAction(assignmentId, {
        criteria: criteria.map((c, ci) => ({
          name:        c.name.trim(),
          description: c.description.trim() || null,
          position:    ci,
          levels:      c.levels.map((l, li) => ({
            label:       l.label.trim(),
            points:      Number(l.points),
            description: l.description.trim() || null,
            position:    li,
          })),
        })),
      });
      if (res.success) toast.success(res.message);
      else toast.error(res.error);
    });
  }

  async function handleDelete() {
    const ok = await openConfirm('Xoá rubric? Tất cả điểm rubric đã chấm sẽ bị xoá.');
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteRubricAction(assignmentId);
      if (res.success) { toast.success(res.message); setCriteria([]); }
      else toast.error(res.error);
    });
  }

  // Tổng điểm tối đa theo rubric (lấy điểm cao nhất mỗi tiêu chí)
  const rubricMax = criteria.reduce((sum, c) => {
    const max = Math.max(0, ...c.levels.map((l) => Number(l.points) || 0));
    return sum + max;
  }, 0);

  return (
    <div className="space-y-4">
      {confirmDialog}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Rubric chấm bài</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {criteria.length === 0
              ? 'Chưa có rubric. Thêm tiêu chí để bắt đầu.'
              : `${criteria.length} tiêu chí · tổng tối đa ${rubricMax} điểm`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasRubric && criteria.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={pending}
              className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Xoá rubric
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={addCriterion} disabled={pending}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Thêm tiêu chí
          </Button>
          {criteria.length > 0 && (
            <Button size="sm" onClick={handleSave} disabled={pending}>
              {pending ? 'Đang lưu...' : 'Lưu rubric'}
            </Button>
          )}
        </div>
      </div>

      {criteria.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 py-10 text-center">
          <p className="text-sm text-muted-foreground">Nhấn "Thêm tiêu chí" để tạo rubric đầu tiên</p>
        </div>
      )}

      <div className="space-y-3">
        {criteria.map((c, ci) => {
          const isOpen = expanded[ci] !== false; // default open
          const maxPts = Math.max(0, ...c.levels.map((l) => Number(l.points) || 0));

          return (
            <div key={ci} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Criterion header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/30">
                <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                <input
                  value={c.name}
                  onChange={(e) => updateCriterion(ci, 'name', e.target.value)}
                  placeholder="Tên tiêu chí..."
                  className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/50"
                />
                <span className="text-xs text-muted-foreground shrink-0">tối đa {maxPts} điểm</span>
                <button onClick={() => removeCriterion(ci)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setExpanded((e) => ({ ...e, [ci]: !isOpen }))}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {isOpen && (
                <div className="p-4 space-y-3">
                  {/* Description */}
                  <input
                    value={c.description}
                    onChange={(e) => updateCriterion(ci, 'description', e.target.value)}
                    placeholder="Mô tả tiêu chí (tuỳ chọn)..."
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                  />

                  {/* Levels grid */}
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(c.levels.length, 4)}, 1fr)` }}>
                    {c.levels.map((l, li) => (
                      <div key={li} className="rounded-lg border border-border bg-background p-3 space-y-2 relative">
                        <button
                          onClick={() => removeLevel(ci, li)}
                          className="absolute top-1.5 right-1.5 text-muted-foreground/40 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                        <input
                          value={l.label}
                          onChange={(e) => updateLevel(ci, li, 'label', e.target.value)}
                          placeholder="Nhãn mức..."
                          className="w-full bg-transparent text-xs font-semibold outline-none placeholder:text-muted-foreground/50 pr-4"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number" min={0}
                            value={l.points}
                            onChange={(e) => updateLevel(ci, li, 'points', e.target.value)}
                            placeholder="0"
                            className="w-16 rounded border border-input bg-muted/30 px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                          <span className="text-xs text-muted-foreground">điểm</span>
                        </div>
                        <textarea
                          value={l.description}
                          onChange={(e) => updateLevel(ci, li, 'description', e.target.value)}
                          placeholder="Mô tả mức này..."
                          rows={2}
                          className="w-full rounded border border-input bg-muted/10 px-2 py-1 text-xs text-muted-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    ))}

                    {c.levels.length < 6 && (
                      <button
                        onClick={() => addLevel(ci)}
                        className="rounded-lg border border-dashed border-border bg-muted/10 p-3 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors flex flex-col items-center justify-center gap-1 min-h-[80px]"
                      >
                        <Plus className="h-4 w-4" />
                        Thêm mức
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {criteria.length > 0 && (
        <div className="flex justify-end pt-2">
          <Button size="sm" onClick={handleSave} disabled={pending}>
            {pending ? 'Đang lưu...' : 'Lưu rubric'}
          </Button>
        </div>
      )}
    </div>
  );
}
