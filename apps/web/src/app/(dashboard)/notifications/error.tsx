'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotificationsError({
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
        <h2 className="text-lg font-semibold">Không thể tải thông báo</h2>
        <p className="text-muted-foreground text-sm">
          {error.message || 'Đã xảy ra lỗi khi tải thông báo. Vui lòng thử lại.'}
        </p>
        {error.digest && (
          <p className="text-muted-foreground/50 font-mono text-xs">{error.digest}</p>
        )}
      </div>
      <Button variant="outline" onClick={reset}>
        Thử lại
      </Button>
    </div>
  );
}
