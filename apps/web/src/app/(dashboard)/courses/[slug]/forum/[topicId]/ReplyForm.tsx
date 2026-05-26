'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export function ReplyForm({
  topicId,
  parentId,
  onDone,
}: {
  topicId: string;
  slug: string;
  parentId?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [content, setContent] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await apiClient.post('/forum/posts', { topicId, content, parentId });
        toast.success('Đã đăng trả lời');
        setContent('');
        onDone?.();
        router.refresh();
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Lỗi đăng bài';
        toast.error(msg);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="border-border bg-card space-y-3 rounded-xl border p-4">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Viết câu trả lời của bạn..."
        rows={4}
        required
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending || !content.trim()}>
          {isPending ? 'Đang gửi...' : 'Gửi trả lời'}
        </Button>
        {onDone && (
          <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={isPending}>
            Huỷ
          </Button>
        )}
      </div>
    </form>
  );
}
