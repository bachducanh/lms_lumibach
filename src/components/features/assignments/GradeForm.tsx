'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/editor/RichTextEditor';
import { toast } from 'sonner';
import { gradeSubmissionAction } from '@/actions/assignments';

type Props = {
  submissionId:    string;
  maxScore:        number;
  currentScore:    number | null | undefined;
  currentFeedback: string;
};

export function GradeForm({ submissionId, maxScore, currentScore, currentFeedback }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [score,    setScore]    = useState(currentScore != null ? String(currentScore) : '');
  const [feedback, setFeedback] = useState(currentFeedback);

  function handleSave() {
    const s = parseFloat(score);
    if (isNaN(s) || s < 0 || s > maxScore) {
      toast.error(`Điểm phải từ 0 đến ${maxScore}`);
      return;
    }
    startTransition(async () => {
      const res = await gradeSubmissionAction(submissionId, s, feedback);
      if (res.success) { toast.success(res.message); router.refresh(); }
      else toast.error(res.error);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <p className="text-sm font-semibold">Chấm bài</p>

      <div className="flex items-center gap-3">
        <label className="text-sm text-muted-foreground shrink-0">Điểm</label>
        <input
          type="number" min={0} max={maxScore} step={0.5}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="text-sm text-muted-foreground">/ {maxScore}</span>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm text-muted-foreground">Nhận xét (tuỳ chọn)</label>
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
