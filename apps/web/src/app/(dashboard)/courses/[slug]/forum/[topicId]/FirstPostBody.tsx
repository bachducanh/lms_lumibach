'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { RichTextView } from '@/components/ui/editor/RichTextView';
import { toRichHtml } from '@/lib/utils';
import { PostEditor } from './PostEditor';

/**
 * Thân chủ đề (bài viết đầu tiên) kèm nút sửa tại chỗ. Tách riêng vì trang chi
 * tiết chủ đề là Server Component, không giữ được trạng thái đóng/mở form.
 */
export function FirstPostBody({
  postId,
  content,
  canUploadImages,
}: {
  postId: string;
  content: string;
  canUploadImages: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <PostEditor
        postId={postId}
        initialContent={content}
        canUploadImages={canUploadImages}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="space-y-2">
      <RichTextView html={toRichHtml(content)} className="text-foreground/90 text-sm" />
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        <Pencil className="h-3 w-3" />
        Sửa nội dung
      </button>
    </div>
  );
}
