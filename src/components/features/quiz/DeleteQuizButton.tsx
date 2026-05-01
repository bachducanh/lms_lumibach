'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { deleteQuizAction } from '@/actions/quizzes';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

type Props = {
  quizId:     string;
  courseSlug: string;
};

export function DeleteQuizButton({ quizId, courseSlug }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirmDialog, openConfirm] = useConfirmDialog();

  async function handleDelete() {
    const ok = await openConfirm('Xoá quiz này? Hành động không thể hoàn tác.');
    if (!ok) return;
    setPending(true);
    try {
      const res = await deleteQuizAction(quizId);
      if (res.success) {
        toast.success(res.message);
        router.push(`/courses/${courseSlug}/quizzes`);
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
        variant="outline"
        size="sm"
        onClick={handleDelete}
        disabled={pending}
        className="text-destructive border-destructive/30 hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4 mr-1.5" />
        Xoá
      </Button>
    </>
  );
}
