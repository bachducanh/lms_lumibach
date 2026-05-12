'use client';

import { useState, useTransition } from 'react';
import { FileUploader } from '@/components/ui/uploader/FileUploader';
import { toast } from 'sonner';
import { FileText, FileImage, FileArchive, File, Trash2, Download } from 'lucide-react';
import type { AttachmentDTO } from '@/actions/attachments';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <FileImage className="h-4 w-4 text-blue-500" />;
  if (mimeType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
  if (mimeType.includes('zip')) return <FileArchive className="h-4 w-4 text-yellow-500" />;
  return <File className="text-muted-foreground h-4 w-4" />;
}

type Props = {
  lessonId: string;
  initialAttachments: AttachmentDTO[];
  canEdit: boolean;
};

export function LessonAttachments({ lessonId, initialAttachments, canEdit }: Props) {
  const [attachments, setAttachments] = useState<AttachmentDTO[]>(initialAttachments);
  const [, startTransition] = useTransition();
  const [confirmDialog, openConfirm] = useConfirmDialog();

  function handleUploadSuccess(data: unknown) {
    const result = data as { attachment?: AttachmentDTO };
    if (result.attachment) {
      setAttachments((prev) => [...prev, result.attachment!]);
      toast.success('Đã tải lên file thành công');
    }
  }

  async function handleDelete(id: string) {
    const ok = await openConfirm('Xoá file đính kèm này?');
    if (!ok) return;
    startTransition(async () => {
      const res = await fetch(`/api/upload/lesson-file?id=${id}`, { method: 'DELETE' });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (res.ok && json.success) {
        setAttachments((prev) => prev.filter((a) => a.id !== id));
        toast.success('Đã xoá file');
      } else {
        toast.error(json.error ?? 'Xoá thất bại');
      }
    });
  }

  return (
    <div className="space-y-3">
      {confirmDialog}
      {attachments.length === 0 && !canEdit && (
        <p className="text-muted-foreground text-sm">Không có file đính kèm.</p>
      )}

      {attachments.length > 0 && (
        <ul className="divide-border border-border divide-y overflow-hidden rounded-lg border">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="hover:bg-muted/30 flex items-center gap-3 px-3 py-2.5 transition-colors"
            >
              <FileIcon mimeType={att.mimeType} />
              <span className="flex-1 truncate text-sm">{att.name}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {formatBytes(att.size)}
              </span>
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                download={att.name}
                className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                title="Tải xuống"
              >
                <Download className="h-4 w-4" />
              </a>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(att.id)}
                  className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                  title="Xoá"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <FileUploader
          uploadUrl="/api/upload/lesson-file"
          extraFields={{ lessonId }}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}
