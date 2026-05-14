'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

type Props = {
  answerId: string;
  maxPoints: number;
  initialScore: number | null;
  initialFeedback: string | null;
};

export function EssayGrader({ answerId, maxPoints, initialScore, initialFeedback }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [score, setScore] = useState(initialScore != null ? String(initialScore) : '');
  const [feedback, setFeedback] = useState(initialFeedback ?? '');

  function handleSave() {
    const pts = Number(score);
    if (score === '' || isNaN(pts)) {
      toast.error('Nhập điểm hợp lệ.');
      return;
    }
    if (pts < 0 || pts > maxPoints) {
      toast.error(`Điểm phải từ 0 đến ${maxPoints}.`);
      return;
    }
    startTransition(async () => {
      try {
        await apiClient.patch(`/attempts/answers/${answerId}/grade`, {
          score: pts,
          feedback: feedback.trim() || null,
        });
        toast.success('Đã lưu điểm.');
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
      }
    });
  }

  return (
    <div className="border-border bg-muted/20 space-y-3 rounded-lg border p-4">
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Chấm điểm tự luận
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={maxPoints}
          step={0.5}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="0"
          className="border-input bg-background focus:ring-ring w-20 rounded-md border px-3 py-1.5 text-center text-sm focus:ring-1 focus:outline-none"
        />
        <span className="text-muted-foreground text-sm">/ {maxPoints} điểm</span>
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Nhận xét (tuỳ chọn)..."
        rows={2}
        className="border-input bg-background focus:ring-ring w-full resize-none rounded-md border px-3 py-2 text-xs focus:ring-1 focus:outline-none"
      />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={handleSave} disabled={pending}>
          {pending ? 'Đang lưu...' : 'Lưu điểm'}
        </Button>
      </div>
    </div>
  );
}
