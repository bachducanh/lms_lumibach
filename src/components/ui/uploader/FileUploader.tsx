'use client';

import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACCEPTED = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/zip', 'application/x-zip-compressed',
  'text/plain', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

const MAX_SIZE = 20 * 1024 * 1024;

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; progress: number; name: string }
  | { phase: 'error'; message: string };

type Props = {
  uploadUrl: string;
  extraFields?: Record<string, string>;
  onSuccess: (data: unknown) => void;
  className?: string;
};

export function FileUploader({ uploadUrl, extraFields = {}, onSuccess, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ phase: 'idle' });
  const [dragging, setDragging] = useState(false);

  function validate(file: File): string | null {
    if (!ACCEPTED.includes(file.type)) return 'Định dạng không được hỗ trợ';
    if (file.size > MAX_SIZE) return 'File tối đa 20 MB';
    return null;
  }

  async function upload(file: File) {
    const err = validate(file);
    if (err) { setState({ phase: 'error', message: err }); return; }

    setState({ phase: 'uploading', progress: 0, name: file.name });

    const formData = new FormData();
    formData.append('file', file);
    for (const [k, v] of Object.entries(extraFields)) formData.append(k, v);

    return new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setState({ phase: 'uploading', progress: Math.round((e.loaded / e.total) * 100), name: file.name });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText) as unknown;
          setState({ phase: 'idle' });
          onSuccess(data);
        } else {
          let msg = 'Upload thất bại';
          try { msg = (JSON.parse(xhr.responseText) as { error?: string }).error ?? msg; } catch { /* ignore */ }
          setState({ phase: 'error', message: msg });
        }
        resolve();
      };

      xhr.onerror = () => {
        setState({ phase: 'error', message: 'Lỗi kết nối' });
        resolve();
      };

      xhr.send(formData);
    });
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    void upload(files[0]!);
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer',
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30',
          state.phase === 'uploading' && 'pointer-events-none opacity-60',
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      >
        <Upload className="h-6 w-6 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Kéo thả hoặc <span className="text-primary font-medium">chọn file</span>
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">PDF, Word, Excel, PowerPoint, ảnh, ZIP — tối đa 20 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {state.phase === 'uploading' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate max-w-[200px]">{state.name}</span>
            <span>{state.progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </div>
      )}

      {state.phase === 'error' && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <X className="h-4 w-4 shrink-0" />
          <span>{state.message}</span>
          <button type="button" className="ml-auto rounded p-0.5 hover:opacity-70 transition-opacity" onClick={() => setState({ phase: 'idle' })}>
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
