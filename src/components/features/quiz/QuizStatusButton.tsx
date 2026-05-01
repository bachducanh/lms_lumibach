'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { setQuizStatusAction } from '@/actions/quizzes';

type Props = {
  quizId:      string;
  isPublished: boolean;
};

export function QuizStatusButton({ quizId, isPublished }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const res = await setQuizStatusAction(quizId, !isPublished);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleToggle} disabled={pending}>
      {isPublished ? (
        <><EyeOff className="h-3.5 w-3.5 mr-1" /> Huỷ đăng</>
      ) : (
        <><Eye className="h-3.5 w-3.5 mr-1" /> Đăng quiz</>
      )}
    </Button>
  );
}
