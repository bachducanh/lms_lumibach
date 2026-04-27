'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/editor/RichTextEditor';
import { toast } from 'sonner';
import { submitAssignmentAction } from '@/actions/assignments';

type Props = {
  assignmentId:  string;
  assignmentType: string;
  draftContent:  string;
  hasSubmitted:  boolean;
  allowResubmit: boolean;
};

export function SubmissionForm({ assignmentId, assignmentType, draftContent, hasSubmitted, allowResubmit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [content, setContent] = useState(draftContent);
  const showEditor = assignmentType === 'TEXT' || assignmentType === 'BOTH';

  if (hasSubmitted && !allowResubmit) {
    return <p className="text-sm text-muted-foreground italic">Bạn đã nộp bài. Bài tập này không cho phép nộp lại.</p>;
  }

  function handleAction(asDraft: boolean) {
    startTransition(async () => {
      const res = await submitAssignmentAction(assignmentId, content, asDraft);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {hasSubmitted && allowResubmit && (
        <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
          Bạn đang nộp lại bài. Bài nộp trước sẽ được thay thế.
        </p>
      )}

      {showEditor && (
        <RichTextEditor
          content={content}
          onChange={setContent}
          placeholder="Nhập câu trả lời của bạn..."
        />
      )}

      {(assignmentType === 'FILE' || assignmentType === 'BOTH') && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground text-center">
          Upload file sẽ có ở phiên bản tiếp theo.
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={() => handleAction(true)} disabled={pending}>
          Lưu nháp
        </Button>
        <Button type="button" size="sm" onClick={() => handleAction(false)} disabled={pending}>
          {pending ? 'Đang nộp...' : hasSubmitted ? 'Nộp lại' : 'Nộp bài'}
        </Button>
      </div>
    </div>
  );
}
