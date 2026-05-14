'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

type Props = {
  quizId: string;
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
      await apiClient.delete(`/quizzes/${quizId}`);
      toast.success('Đã xoá quiz.');
      router.push(`/courses/${courseSlug}/quizzes`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Có lỗi không mong muốn. Vui lòng thử lại.');
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
        <Trash2 className="mr-1.5 h-4 w-4" />
        Xoá
      </Button>
    </>
  );
}
