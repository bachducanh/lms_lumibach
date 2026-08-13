'use client';

import { useState, useTransition } from 'react';
import nextDynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { richTextIsEmpty } from '@/lib/utils';

const RichTextEditor = nextDynamic(
  () =>
    import('@/components/ui/editor/RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
  { ssr: false, loading: () => <div className="bg-muted/30 h-40 animate-pulse rounded-xl" /> }
);

export function NewTopicForm({
  courseId,
  slug,
  forumId,
  canUploadImages,
}: {
  courseId: string;
  slug: string;
  forumId?: string;
  /** Upload ảnh chỉ mở cho GV trở lên — ẩn nút với học sinh thay vì để bấm rồi lỗi. */
  canUploadImages: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (richTextIsEmpty(content)) {
      toast.error('Nhập nội dung chủ đề.');
      return;
    }
    startTransition(async () => {
      try {
        const data = await apiClient.post<{ topicId: string }>('/forum/topics', {
          courseId,
          forumId: forumId ?? null,
          title,
          content,
        });
        toast.success('Đã tạo chủ đề');
        router.push(`/courses/${slug}/forum/${data.topicId}`);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Lỗi tạo chủ đề';
        toast.error(msg);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="border-border bg-card space-y-4 rounded-xl border p-5">
        <div className="space-y-1.5">
          <Label htmlFor="title">Tiêu đề</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tiêu đề chủ đề của bạn..."
            maxLength={200}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label>Nội dung</Label>
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="Mô tả chi tiết câu hỏi hoặc chủ đề thảo luận..."
            allowImages={canUploadImages}
            compact
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Đang đăng...' : 'Đăng chủ đề'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isPending}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}
