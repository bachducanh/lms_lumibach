'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function QuizzesError({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full">
        <AlertTriangle className="text-destructive h-8 w-8" />
      </div>
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold">Không thể tải danh sách quiz</h2>
        <p className="text-muted-foreground text-sm">
          {error.message || 'Đã xảy ra lỗi khi tải quiz. Vui lòng thử lại.'}
        </p>
        {error.digest && (
          <p className="text-muted-foreground/50 font-mono text-xs">{error.digest}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={reset}>
          Thử lại
        </Button>
        <Link
          href=".."
          className="border-border bg-background hover:bg-accent inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium transition-colors"
        >
          Về khóa học
        </Link>
      </div>
    </div>
  );
}
