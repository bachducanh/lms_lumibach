'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteSubmissionAction } from '@/actions/assignments';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

export function DeleteSubmissionButton({ submissionId, studentName }: { submissionId: string; studentName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDialog, openConfirm] = useConfirmDialog();

  async function handleDelete() {
    const ok = await openConfirm(`Xoá bài nộp của ${studentName}? Học sinh sẽ có thể nộp lại từ đầu.`);
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteSubmissionAction(submissionId);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      {confirmDialog}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={pending}
        className="text-muted-foreground hover:text-destructive"
        title="Xoá bài nộp"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  );
}
