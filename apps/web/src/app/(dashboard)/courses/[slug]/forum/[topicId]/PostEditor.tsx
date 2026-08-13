'use client';

import { useState, useTransition } from 'react';
import nextDynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { richTextIsEmpty, toRichHtml } from '@/lib/utils';

const RichTextEditor = nextDynamic(
  () =>
    import('@/components/ui/editor/RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
  { ssr: false, loading: () => <div className="bg-muted/30 h-32 animate-pulse rounded-xl" /> }
);

/**
 * Sửa nội dung một bài viết diễn đàn tại chỗ.
 *
 * Bài đầu tiên của chủ đề chính là phần thân chủ đề, nên đây cũng là đường để
 * quản lý / giáo viên / trợ giảng sửa nội dung chủ đề do học sinh viết.
 */
export function PostEditor({
  postId,
  initialContent,
  canUploadImages,
  onDone,
}: {
  postId: string;
  initialContent: string;
  canUploadImages: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Bài cũ lưu văn bản thô — nâng lên HTML để editor không nuốt xuống dòng.
  const [content, setContent] = useState(() => toRichHtml(initialContent));

  function handleSave() {
    if (richTextIsEmpty(content)) {
      toast.error('Nội dung không được để trống.');
      return;
    }
    startTransition(async () => {
      try {
        await apiClient.patch(`/forum/posts/${postId}`, { content });
        toast.success('Đã lưu nội dung');
        onDone();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi lưu nội dung');
      }
    });
  }

  return (
    <div className="space-y-2">
      <RichTextEditor
        content={content}
        onChange={setContent}
        allowImages={canUploadImages}
        compact
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Đang lưu...' : 'Lưu'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} disabled={isPending}>
          Huỷ
        </Button>
      </div>
    </div>
  );
}
