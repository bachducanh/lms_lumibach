'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle2, Circle } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';

type Props = {
  moduleItemId: string;
  isCompleted: boolean;
  courseSlug: string;
  lessonId: string;
};

export function MarkCompleteButton({
  moduleItemId,
  isCompleted,
  courseSlug: _courseSlug,
  lessonId: _lessonId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        if (isCompleted) {
          await apiClient.delete(`/lessons/completions/${moduleItemId}`);
          toast.success('Đã bỏ đánh dấu hoàn thành.');
        } else {
          await apiClient.post('/lessons/completions', { moduleItemId });
          toast.success('Đã đánh dấu hoàn thành.');
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi cập nhật tiến độ');
      }
    });
  }

  if (isCompleted) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={handleClick}
        disabled={pending}
        className="hover:text-muted-foreground hover:bg-muted gap-1.5 text-green-600"
      >
        <CheckCircle2 className="h-4 w-4" />
        {pending ? 'Đang cập nhật...' : 'Đã hoàn thành'}
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={pending}
      className="gap-1.5"
    >
      <Circle className="h-4 w-4" />
      {pending ? 'Đang lưu...' : 'Đánh dấu hoàn thành'}
    </Button>
  );
}
