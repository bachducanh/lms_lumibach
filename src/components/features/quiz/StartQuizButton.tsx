'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PlayCircle } from 'lucide-react';
import { startAttemptAction } from '@/actions/attempts';

type Props = {
  quizId:     string;
  courseSlug: string;
  label?:     string;
};

export function StartQuizButton({ quizId, courseSlug, label = 'Bắt đầu làm bài' }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleStart() {
    startTransition(async () => {
      const res = await startAttemptAction(quizId);
      if (res.success && res.data) {
        router.push(`/courses/${courseSlug}/quizzes/${quizId}/attempt/${res.data.attemptId}`);
      } else if (!res.success) {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button onClick={handleStart} disabled={pending} size="lg" className="gap-2">
      <PlayCircle className="h-5 w-5" />
      {pending ? 'Đang tải...' : label}
    </Button>
  );
}
