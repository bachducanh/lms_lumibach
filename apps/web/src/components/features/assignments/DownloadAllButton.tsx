'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  assignmentId: string;
  count: number;
  className?: string;
};

export function DownloadAllButton({ assignmentId, count, className }: Props) {
  const [loading, setLoading] = useState(false);

  function handleClick() {
    if (loading || count === 0) return;
    setLoading(true);
    // Tải native qua thẻ <a> để trình duyệt stream thẳng ra đĩa (không buffer vào RAM).
    const a = document.createElement('a');
    a.href = `/api/assignments/${assignmentId}/download-all`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Không thể biết chính xác lúc tải xong; reset sau ít giây để tránh bấm liên tục.
    setTimeout(() => setLoading(false), 2500);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || count === 0}
      title="Tải tất cả bài đã nộp (mỗi học sinh một thư mục)"
      className={cn(
        'border-border bg-background hover:bg-accent inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {loading ? 'Đang nén...' : `Tải tất cả (${count})`}
    </button>
  );
}
