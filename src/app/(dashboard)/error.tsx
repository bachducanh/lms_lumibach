'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function DashboardError({
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
        <h2 className="text-xl font-semibold">Đã xảy ra lỗi</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Trang này gặp sự cố không mong muốn. Vui lòng thử lại hoặc liên hệ quản trị viên nếu vấn đề tiếp tục xảy ra.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/50 font-mono">Mã lỗi: {error.digest}</p>
        )}
      </div>
      <Button onClick={reset} variant="outline" className="gap-2">
        <RotateCcw className="h-4 w-4" />
        Thử lại
      </Button>
    </div>
  );
}
