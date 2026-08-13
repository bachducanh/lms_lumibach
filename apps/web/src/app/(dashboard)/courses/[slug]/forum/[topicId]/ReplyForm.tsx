'use client';

import { useState, useTransition } from 'react';
import nextDynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { richTextIsEmpty } from '@/lib/utils';

const RichTextEditor = nextDynamic(
  () =>
    import('@/components/ui/editor/RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
  { ssr: false, loading: () => <div className="bg-muted/30 h-32 animate-pulse rounded-xl" /> }
);

export function ReplyForm({
  topicId,
  parentId,
  canUploadImages = false,
  onDone,
}: {
  topicId: string;
  slug: string;
  parentId?: string;
  canUploadImages?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [content, setContent] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (richTextIsEmpty(content)) {
      toast.error('Nhập nội dung trả lời.');
      return;
    }
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
      <RichTextEditor
        content={content}
        onChange={setContent}
        placeholder="Viết câu trả lời của bạn..."
        allowImages={canUploadImages}
        compact
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
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
