'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PlayCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type Props = {
  quizId: string;
  courseSlug: string;
  label?: string;
};

export function StartQuizButton({ quizId, courseSlug, label = 'Bắt đầu làm bài' }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleStart() {
    startTransition(async () => {
      try {
        const data = await apiClient.post<{ attemptId: string }>('/attempts', { quizId });
        router.push(`/courses/${courseSlug}/quizzes/${quizId}/attempt/${data.attemptId}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
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
