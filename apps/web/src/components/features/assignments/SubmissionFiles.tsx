'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  FileText,
  FileImage,
  FileAudio,
  FileVideo,
  FileArchive,
  FileSpreadsheet,
  File as FileIcon,
  Download,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type SubmissionFileItem = {
  id?: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
};

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Phải khớp với dispositionType ở route upload: chỉ những loại này được serve inline.
function previewKind(mime: string): 'image' | 'audio' | 'pdf' | null {
  const m = (mime || '').toLowerCase();
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('image/') && m !== 'image/svg+xml') return 'image';
  return null;
}

function FileTypeIcon({ mime }: { mime: string }) {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return <FileImage className="h-4 w-4 text-blue-500" />;
  if (m.startsWith('audio/')) return <FileAudio className="h-4 w-4 text-purple-500" />;
  if (m.startsWith('video/')) return <FileVideo className="h-4 w-4 text-pink-500" />;
  if (m === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
  if (m.includes('zip') || m.includes('rar') || m.includes('compressed') || m.includes('7z'))
    return <FileArchive className="h-4 w-4 text-yellow-500" />;
  if (m.includes('sheet') || m.includes('excel') || m === 'text/csv')
    return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
  if (m.includes('word') || m.includes('document') || m === 'text/plain')
    return <FileText className="h-4 w-4 text-sky-500" />;
  return <FileIcon className="text-muted-foreground h-4 w-4" />;
}

function FilePreview({ file }: { file: SubmissionFileItem }) {
  const kind = previewKind(file.mimeType);
  if (kind === 'image')
    return (
      <img
        src={file.url}
        alt={file.name}
        className="mx-auto max-h-[72vh] w-auto rounded-lg object-contain"
      />
    );
  if (kind === 'pdf')
    return (
      <iframe src={file.url} title={file.name} className="h-[72vh] w-full rounded-lg border-0" />
    );
  if (kind === 'audio')
    return (
      <div className="py-10">
        <audio src={file.url} controls className="w-full">
          <track kind="captions" />
        </audio>
      </div>
    );
  return null;
}

type Props = {
  files: SubmissionFileItem[];
  className?: string;
};

export function SubmissionFiles({ files, className }: Props) {
  const [active, setActive] = useState<SubmissionFileItem | null>(null);
  if (files.length === 0) return null;

  return (
    <>
      <div className={cn('grid gap-2 sm:grid-cols-2', className)}>
        {files.map((f, i) => {
          const canView = previewKind(f.mimeType) !== null;
          return (
            <div
              key={f.id ?? `${f.url}-${i}`}
              className="border-border bg-card flex items-center gap-3 rounded-xl border px-3 py-2.5"
            >
              <div className="bg-muted/50 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                <FileTypeIcon mime={f.mimeType} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={f.name}>
                  {f.name}
                </p>
                <p className="text-muted-foreground text-xs">{formatBytes(f.size)}</p>
              </div>
              {canView && (
                <button
                  type="button"
                  onClick={() => setActive(f)}
                  className="text-muted-foreground hover:text-primary hover:bg-muted shrink-0 rounded-md p-1.5 transition-colors"
                  title="Xem trực tiếp"
                >
                  <Eye className="h-4 w-4" />
                </button>
              )}
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                download={f.name}
                className="text-muted-foreground hover:text-primary hover:bg-muted shrink-0 rounded-md p-1.5 transition-colors"
                title="Tải xuống"
              >
                <Download className="h-4 w-4" />
              </a>
            </div>
          );
        })}
      </div>

      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-w-4xl sm:max-w-4xl">
          <DialogTitle className="truncate pr-8">{active?.name}</DialogTitle>
          {active && <FilePreview file={active} />}
          {active && (
            <a
              href={active.url}
              target="_blank"
              rel="noopener noreferrer"
              download={active.name}
              className="text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
            >
              <Download className="h-4 w-4" /> Tải xuống
            </a>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
