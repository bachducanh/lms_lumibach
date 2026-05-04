'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw, ChevronLeft } from 'lucide-react';

export default function CourseError({
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Không thể tải khóa học</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Khóa học không tồn tại hoặc bạn không có quyền truy cập. Vui lòng thử lại hoặc quay về danh sách khóa học.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Thử lại
        </Button>
        <Button asChild variant="ghost" className="gap-2">
          <Link href="/courses">
            <ChevronLeft className="h-4 w-4" />
            Danh sách khóa học
          </Link>
        </Button>
      </div>
    </div>
  );
}
