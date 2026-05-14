'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/editor/RichTextEditor';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

type Props = {
  assignmentId: string;
  assignmentType: string;
  initialContent: string;
  isEdit: boolean;
};

export function SubmissionForm({ assignmentId, assignmentType, initialContent, isEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [content, setContent] = useState(initialContent);
  const showEditor = assignmentType === 'TEXT' || assignmentType === 'BOTH';

  function handleAction(asDraft: boolean) {
    startTransition(async () => {
      try {
        await apiClient.post(`/assignments/${assignmentId}/submissions`, { content, asDraft });
        toast.success(asDraft ? 'Đã lưu nháp.' : 'Đã nộp bài.');
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
      }
    });
  }

  return (
    <div className="space-y-4">
      {showEditor && (
        <RichTextEditor
          content={content}
          onChange={setContent}
          placeholder="Nhập câu trả lời của bạn..."
        />
      )}

      {(assignmentType === 'FILE' || assignmentType === 'BOTH') && (
        <div className="border-border bg-muted/30 text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
          Upload file sẽ có ở phiên bản tiếp theo.
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleAction(true)}
          disabled={pending}
        >
          Lưu nháp
        </Button>
        <Button type="button" size="sm" onClick={() => handleAction(false)} disabled={pending}>
          {pending ? 'Đang lưu...' : isEdit ? 'Cập nhật bài nộp' : 'Nộp bài'}
        </Button>
      </div>
    </div>
  );
}
