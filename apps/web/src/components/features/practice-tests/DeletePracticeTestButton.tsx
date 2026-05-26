'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

type Props = {
  practiceTestId: string;
  courseSlug: string;
};

export function DeletePracticeTestButton({ practiceTestId, courseSlug }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirmDialog, openConfirm] = useConfirmDialog();

  async function handleDelete() {
    const ok = await openConfirm('Xóa đề luyện tập này? Các bài làm đã nộp cũng sẽ bị xóa.');
    if (!ok) return;
    setPending(true);
    try {
      await apiClient.delete(`/practice-tests/${practiceTestId}`);
      toast.success('Đã xóa đề luyện tập.');
      router.push(`/courses/${courseSlug}/modules`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra.');
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
        Xóa
      </Button>
    </>
  );
}
