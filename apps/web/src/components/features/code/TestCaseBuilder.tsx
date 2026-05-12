'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type TC = {
  id?: string;
  label: string | null;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  points: number;
  position: number;
};

type Props = {
  initial: TC[];
  onChange: (tcs: TC[]) => void;
};

function empty(): TC {
  return { label: '', input: '', expectedOutput: '', isHidden: true, points: 1, position: 0 };
}

export function TestCaseBuilder({ initial, onChange }: Props) {
  const [tcs, setTcs] = useState<TC[]>(initial.length > 0 ? initial : [empty()]);

  function update(idx: number, patch: Partial<TC>) {
    const next = tcs.map((tc, i) => (i === idx ? { ...tc, ...patch } : tc));
    setTcs(next);
    onChange(next.map((tc, i) => ({ ...tc, position: i })));
  }

  function add() {
    const next = [...tcs, empty()];
    setTcs(next);
    onChange(next.map((tc, i) => ({ ...tc, position: i })));
  }

  function remove(idx: number) {
    const next = tcs.filter((_, i) => i !== idx);
    setTcs(next);
    onChange(next.map((tc, i) => ({ ...tc, position: i })));
  }

  const cellCls = 'px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground';
  const inputCls =
    'w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none';

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="border-border grid grid-cols-[2fr_2fr_5rem_4rem_3rem_2rem] gap-2 border-b pb-1">
        <span className={cellCls}>Input</span>
        <span className={cellCls}>Output mong đợi</span>
        <span className={cellCls}>Label</span>
        <span className={cellCls}>Điểm</span>
        <span className={cellCls}>Ẩn</span>
        <span />
      </div>

      {tcs.map((tc, i) => (
        <div key={i} className="grid grid-cols-[2fr_2fr_5rem_4rem_3rem_2rem] items-start gap-2">
          <textarea
            value={tc.input}
            onChange={(e) => update(i, { input: e.target.value })}
            placeholder="stdin..."
            rows={3}
            className={inputCls}
          />
          <textarea
            value={tc.expectedOutput}
            onChange={(e) => update(i, { expectedOutput: e.target.value })}
            placeholder="stdout..."
            rows={3}
            className={inputCls}
          />
          <input
            type="text"
            value={tc.label ?? ''}
            onChange={(e) => update(i, { label: e.target.value || null })}
            placeholder="Test 1"
            className="border-input bg-background focus:ring-ring w-full rounded-md border px-2 py-1.5 text-xs focus:ring-1 focus:outline-none"
          />
          <input
            type="number"
            min={0}
            step={0.5}
            value={tc.points}
            onChange={(e) => update(i, { points: Number(e.target.value) })}
            className="border-input bg-background focus:ring-ring w-full rounded-md border px-2 py-1.5 text-center text-xs focus:ring-1 focus:outline-none"
          />
          <div className="flex justify-center pt-2">
            <input
              type="checkbox"
              checked={tc.isHidden}
              onChange={(e) => update(i, { isHidden: e.target.checked })}
              title="Ẩn với học sinh"
              className="accent-primary h-4 w-4 cursor-pointer"
            />
          </div>
          <button
            type="button"
            onClick={() => remove(i)}
            disabled={tcs.length === 1}
            className={cn(
              'text-muted-foreground mt-1 flex h-6 w-6 items-center justify-center rounded transition-colors',
              tcs.length > 1 ? 'hover:text-destructive hover:bg-destructive/10' : 'opacity-30'
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="border-border text-muted-foreground hover:border-primary hover:text-primary inline-flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-xs transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Thêm test case
      </button>

      <p className="text-muted-foreground text-xs">
        <span className="font-medium">Ẩn ☑</span> = học sinh không thấy input/output. Chạy mẫu chỉ
        dùng test không ẩn.
      </p>
    </div>
  );
}
