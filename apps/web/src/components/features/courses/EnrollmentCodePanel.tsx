'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Copy, RefreshCw } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';

type Props = {
  courseId: string;
  initialCode: string | null;
  canManage: boolean;
};

export function EnrollmentCodePanel({ courseId, initialCode, canManage }: Props) {
  const [code, setCode] = useState(initialCode);
  const [pending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      try {
        const data = await apiClient.post<{ code: string }>(`/courses/${courseId}/enrollment-code`);
        setCode(data.code);
        toast.success('Đã tạo mã tham gia mới.');
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi tạo mã tham gia');
      }
    });
  }

  function handleCopy() {
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast.success('Đã sao chép mã tham gia');
  }

  if (!canManage && !code) return null;

  return (
    <div className="border-border bg-card space-y-2 rounded-xl border p-4">
      <p className="text-sm font-medium">Mã tham gia lớp</p>
      {code ? (
        <div className="flex items-center gap-2">
          <span className="text-primary font-mono text-xl font-bold tracking-widest">{code}</span>
          <button
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Copy className="h-4 w-4" />
          </button>
          {canManage && (
            <button
              onClick={handleGenerate}
              disabled={pending}
              className="text-muted-foreground hover:text-foreground ml-1 transition-colors"
              title="Tạo mã mới"
            >
              <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      ) : (
        canManage && (
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={pending}>
            Tạo mã tham gia
          </Button>
        )
      )}
      <p className="text-muted-foreground text-xs">Học sinh dùng mã này để tự đăng ký vào lớp.</p>
    </div>
  );
}
