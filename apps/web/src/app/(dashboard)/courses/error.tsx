'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { AlertTriangle, RotateCcw, BookOpen } from 'lucide-react';

export default function CoursesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full">
        <AlertTriangle className="text-destructive h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Không thể tải khóa học</h2>
        <p className="text-muted-foreground max-w-md text-sm">
          Đã xảy ra lỗi khi tải danh sách khóa học. Vui lòng thử lại.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Thử lại
        </Button>
        <Link href="/dashboard" className={buttonVariants({ variant: 'ghost' }) + ' gap-2'}>
          <BookOpen className="h-4 w-4" />
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
