'use client';

import { useRef, useState } from 'react';
import { Upload, Loader2, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Props = {
  kind: 'starter' | 'submission';
  exerciseId?: string;
  onUploaded: (url: string, filename: string) => void;
  /** Already-uploaded URL (preview-only mode) */
  initialUrl?: string | null;
  initialName?: string | null;
};

export function Sb3Upload({ kind, exerciseId, onUploaded, initialUrl, initialName }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(initialUrl ?? null);
  const [savedName, setSavedName] = useState<string | null>(initialName ?? null);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.sb3')) {
      toast.error('Cần file .sb3 (project Scratch).');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File tối đa 50 MB.');
      return;
    }

    setPending(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', kind);
      if (exerciseId) fd.append('exerciseId', exerciseId);

      const res = await fetch('/api/upload/scratch', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Upload thất bại.');
        return;
      }

      setSavedUrl(data.url);
      setSavedName(file.name);
      onUploaded(data.url, file.name);
      toast.success('Đã tải lên project Scratch.');
    } catch {
      toast.error('Lỗi mạng khi tải lên.');
    } finally {
      setPending(false);
    }
  }

  function handleClear() {
    setSavedUrl(null);
    setSavedName(null);
    if (inputRef.current) inputRef.current.value = '';
    onUploaded('', '');
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  // Already uploaded state
  if (savedUrl) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <p className="truncate text-sm font-medium">{savedName ?? 'project.sb3'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a href={savedUrl} download className="text-muted-foreground hover:text-primary text-xs">
            Tải xuống
          </a>
          <button
            type="button"
            onClick={handleClear}
            className="text-muted-foreground/60 hover:text-destructive"
            title="Bỏ file này"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <label
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-all',
        dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/10 hover:bg-muted/20',
        pending && 'pointer-events-none opacity-60'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".sb3"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      {pending ? (
        <>
          <Loader2 className="text-primary h-6 w-6 animate-spin" />
          <p className="text-muted-foreground text-xs">Đang tải lên...</p>
        </>
      ) : (
        <>
          <Upload className="text-muted-foreground h-6 w-6" />
          <p className="text-sm font-medium">
            Kéo file <code className="text-primary font-mono">.sb3</code> vào đây
          </p>
          <p className="text-muted-foreground text-xs">hoặc click để chọn file</p>
        </>
      )}
    </label>
  );
}
