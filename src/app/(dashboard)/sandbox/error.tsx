'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SandboxError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold">Không thể tải Sandbox</h2>
        <p className="text-sm text-muted-foreground">{error.message || 'Đã xảy ra lỗi không mong muốn.'}</p>
      </div>
      <Button variant="outline" onClick={reset}>Thử lại</Button>
    </div>
  );
}
