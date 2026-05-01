'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { gradeEssayAction } from '@/actions/attempts';

type Props = {
  answerId:        string;
  maxPoints:       number;
  initialScore:    number | null;
  initialFeedback: string | null;
};

export function EssayGrader({ answerId, maxPoints, initialScore, initialFeedback }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [score,    setScore]    = useState(initialScore != null ? String(initialScore) : '');
  const [feedback, setFeedback] = useState(initialFeedback ?? '');

  function handleSave() {
    const pts = Number(score);
    if (score === '' || isNaN(pts)) { toast.error('Nhập điểm hợp lệ.'); return; }
    if (pts < 0 || pts > maxPoints)  { toast.error(`Điểm phải từ 0 đến ${maxPoints}.`); return; }
    startTransition(async () => {
      const res = await gradeEssayAction(answerId, pts, feedback.trim() || null);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chấm điểm tự luận</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={maxPoints}
          step={0.5}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="0"
          className="w-20 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring text-center"
        />
        <span className="text-sm text-muted-foreground">/ {maxPoints} điểm</span>
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Nhận xét (tuỳ chọn)..."
        rows={2}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
      />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={handleSave} disabled={pending}>
          {pending ? 'Đang lưu...' : 'Lưu điểm'}
        </Button>
      </div>
    </div>
  );
}
