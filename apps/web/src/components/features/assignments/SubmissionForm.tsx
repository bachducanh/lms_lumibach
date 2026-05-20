'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/editor/RichTextEditor';
import { FileUploader } from '@/components/ui/uploader/FileUploader';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { Paperclip, X } from 'lucide-react';

type SubmissionFile = {
  name: string;
  url: string;
  mimeType: string;
  size: number;
};

type DraftFile = SubmissionFile & { isNew?: boolean };

type Props = {
  assignmentId: string;
  assignmentType: string;
  initialContent: string;
  initialFiles: SubmissionFile[];
  maxFiles: number | null;
  maxFileSizeMb: number | null;
  isEdit: boolean;
};

const DEFAULT_MAX_MB = 50;

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SubmissionForm({
  assignmentId,
  assignmentType,
  initialContent,
  initialFiles,
  maxFiles,
  maxFileSizeMb,
  isEdit,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [content, setContent] = useState(initialContent);
  const [files, setFiles] = useState<DraftFile[]>(initialFiles);

  const showEditor = assignmentType === 'TEXT' || assignmentType === 'BOTH';
  const showUploader = assignmentType === 'FILE' || assignmentType === 'BOTH';
  const maxSizeMb = maxFileSizeMb ?? DEFAULT_MAX_MB;
  const limitReached = maxFiles != null && maxFiles > 0 && files.length >= maxFiles;

  function handleUploadSuccess(data: unknown) {
    const result = data as { file?: SubmissionFile };
    if (!result.file) return;
    setFiles((prev) => [...prev, { ...result.file!, isNew: true }]);
    toast.success('Đã tải lên file.');
  }

  function handleRemove(target: DraftFile) {
    // Chỉ xoá vật lý trên storage với file vừa upload trong phiên này (chưa được lưu vào bài nộp).
    if (target.isNew) {
      void fetch(`/api/upload/submission-file?url=${encodeURIComponent(target.url)}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
    setFiles((prev) => prev.filter((f) => f.url !== target.url));
  }

  function handleAction(asDraft: boolean) {
    if (showUploader && !showEditor && files.length === 0) {
      toast.error('Vui lòng đính kèm ít nhất một file.');
      return;
    }
    startTransition(async () => {
      try {
        await apiClient.post(`/assignments/${assignmentId}/submissions`, {
          content,
          asDraft,
          files: files.map(({ name, url, mimeType, size }) => ({ name, url, mimeType, size })),
        });
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

      {showUploader && (
        <div className="space-y-3">
          {files.length > 0 && (
            <ul className="divide-border border-border divide-y overflow-hidden rounded-lg border">
              {files.map((f) => (
                <li
                  key={f.url}
                  className="hover:bg-muted/30 flex items-center gap-3 px-3 py-2.5 transition-colors"
                >
                  <Paperclip className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate text-sm" title={f.name}>
                    {f.name}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatBytes(f.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(f)}
                    disabled={pending}
                    className="text-muted-foreground hover:text-destructive shrink-0 p-1 transition-colors"
                    title="Gỡ bỏ"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {limitReached ? (
            <p className="text-muted-foreground bg-muted/30 border-border rounded-lg border border-dashed px-4 py-3 text-center text-xs">
              Đã đạt số file tối đa ({maxFiles}). Gỡ bớt file để tải thêm.
            </p>
          ) : (
            <FileUploader
              uploadUrl="/api/upload/submission-file"
              extraFields={{ assignmentId }}
              acceptAll
              maxSizeMb={maxSizeMb}
              hint={`Mọi định dạng file — tối đa ${maxSizeMb} MB${maxFiles ? ` · tối đa ${maxFiles} file` : ''}`}
              onSuccess={handleUploadSuccess}
            />
          )}
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
