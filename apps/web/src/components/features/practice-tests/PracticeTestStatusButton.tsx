'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

type Props = {
  practiceTestId: string;
  isPublished: boolean;
};

export function PracticeTestStatusButton({ practiceTestId, isPublished }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      try {
        await apiClient.patch(`/practice-tests/${practiceTestId}/status`, {
          publish: !isPublished,
        });
        toast.success(isPublished ? 'Đã chuyển về nháp.' : 'Đã đăng đề luyện tập.');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra.');
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleToggle} disabled={pending}>
      {isPublished ? (
        <>
          <EyeOff className="mr-1.5 h-4 w-4" />
          Hủy đăng
        </>
      ) : (
        <>
          <Eye className="mr-1.5 h-4 w-4" />
          Đăng
        </>
      )}
    </Button>
  );
}
