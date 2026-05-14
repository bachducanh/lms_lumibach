'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type Props = {
  quizId: string;
  isPublished: boolean;
};

export function QuizStatusButton({ quizId, isPublished }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      try {
        await apiClient.patch(`/quizzes/${quizId}/status`, { publish: !isPublished });
        toast.success(isPublished ? 'Đã huỷ đăng quiz.' : 'Đã đăng quiz.');
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleToggle} disabled={pending}>
      {isPublished ? (
        <>
          <EyeOff className="mr-1 h-3.5 w-3.5" /> Huỷ đăng
        </>
      ) : (
        <>
          <Eye className="mr-1 h-3.5 w-3.5" /> Đăng quiz
        </>
      )}
    </Button>
  );
}
