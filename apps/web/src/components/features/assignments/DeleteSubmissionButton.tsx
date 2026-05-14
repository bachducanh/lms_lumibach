'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

export function DeleteSubmissionButton({
  submissionId,
  studentName,
}: {
  submissionId: string;
  studentName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDialog, openConfirm] = useConfirmDialog();

  async function handleDelete() {
    const ok = await openConfirm(
      `Xoá bài nộp của ${studentName}? Học sinh sẽ có thể nộp lại từ đầu.`
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        await apiClient.delete(`/assignments/submissions/${submissionId}`);
        toast.success('Đã xoá bài nộp.');
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
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
