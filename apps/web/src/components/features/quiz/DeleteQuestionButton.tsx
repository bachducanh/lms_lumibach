'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { deleteQuestionAction } from '@/actions/questions';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

export function DeleteQuestionButton({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirmDialog, openConfirm] = useConfirmDialog();

  async function handleDelete() {
    const ok = await openConfirm(
      'Xoá câu hỏi này? Câu hỏi sẽ bị xoá khỏi tất cả quiz đang sử dụng nó.'
    );
    if (!ok) return;
    setPending(true);
    try {
      const res = await deleteQuestionAction(questionId);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error('Có lỗi không mong muốn. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {confirmDialog}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleDelete}
        disabled={pending}
        className="text-muted-foreground/50 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  );
}
