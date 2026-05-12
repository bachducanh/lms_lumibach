'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle2, Circle } from 'lucide-react';
import { markLessonCompleteAction, unmarkLessonCompleteAction } from '@/actions/lessons';

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
      const res = isCompleted
        ? await unmarkLessonCompleteAction(moduleItemId)
        : await markLessonCompleteAction(moduleItemId);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.error);
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
