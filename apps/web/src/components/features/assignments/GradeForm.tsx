'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/editor/RichTextEditor';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

type Props = {
  submissionId: string;
  maxScore: number;
  currentScore: number | null | undefined;
  currentFeedback: string;
};

export function GradeForm({ submissionId, maxScore, currentScore, currentFeedback }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [score, setScore] = useState(currentScore != null ? String(currentScore) : '');
  const [feedback, setFeedback] = useState(currentFeedback);

  function handleSave() {
    const s = parseFloat(score);
    if (isNaN(s) || s < 0 || s > maxScore) {
      toast.error(`Điểm phải từ 0 đến ${maxScore}`);
      return;
    }
    startTransition(async () => {
      try {
        await apiClient.patch(`/assignments/submissions/${submissionId}/grade`, {
          score: s,
          feedback,
        });
        toast.success('Đã lưu điểm.');
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
      }
    });
  }

  return (
    <div className="border-border bg-card space-y-4 rounded-xl border p-5">
      <p className="text-sm font-semibold">Chấm bài</p>

      <div className="flex items-center gap-3">
        <label className="text-muted-foreground shrink-0 text-sm">Điểm</label>
        <input
          type="number"
          min={0}
          max={maxScore}
          step={0.5}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="border-input bg-background focus:ring-ring w-24 rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
        />
        <span className="text-muted-foreground text-sm">/ {maxScore}</span>
      </div>

      <div className="space-y-1.5">
        <label className="text-muted-foreground text-sm">Nhận xét (tuỳ chọn)</label>
        <RichTextEditor
          content={feedback}
          onChange={setFeedback}
          placeholder="Nhận xét, góp ý cho học sinh..."
        />
      </div>

      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={handleSave} disabled={pending}>
          {pending ? 'Đang lưu...' : 'Lưu điểm'}
        </Button>
      </div>
    </div>
  );
}
