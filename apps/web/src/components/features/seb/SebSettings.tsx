'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, UploadCloud, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export type SebConfig = { url: string; name: string } | null;

type Props = {
  courseId: string;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  config: SebConfig;
  onConfigChange: (value: SebConfig) => void;
};

/**
 * Cấu hình chế độ kiểm tra Safe Exam Browser cho một hoạt động (Quiz / Đề luyện tập).
 * Giáo viên chỉ cần: bật công tắc + tải file `.seb` của mình lên. Khi đã bật, học sinh
 * bắt buộc mở bài bằng Safe Exam Browser (đối chiếu qua header/User-Agent ở phía server).
 */
export function SebSettings({ courseId, enabled, onEnabledChange, config, onConfigChange }: Props) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File | null) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.seb')) {
      toast.error('Chỉ hỗ trợ file cấu hình Safe Exam Browser (.seb).');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('courseId', courseId);
      const res = await fetch('/api/upload/seb-config', { method: 'POST', body: form });
      const data = (await res.json()) as { file?: { url: string; name: string }; error?: string };
      if (!res.ok || !data.file) throw new Error(data.error ?? 'Upload thất bại.');
      onConfigChange({ url: data.file.url, name: data.file.name });
      toast.success('Đã tải file cấu hình SEB lên.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload thất bại.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border-border bg-muted/20 space-y-4 rounded-xl border p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <Switch checked={enabled} onCheckedChange={onEnabledChange} className="mt-0.5" />
        <span className="space-y-0.5">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Chế độ kiểm tra Safe Exam Browser
          </span>
          <span className="text-muted-foreground block text-xs">
            Khi bật, học sinh bắt buộc mở bài bằng Safe Exam Browser theo đúng file cấu hình bạn tải
            lên. Trình duyệt thường sẽ bị chặn.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="space-y-3 border-t border-dashed pt-3 pl-1">
          {config ? (
            <div className="border-border bg-background flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{config.name}</p>
                <p className="text-muted-foreground text-xs">File cấu hình SEB</p>
              </div>
              <button
                type="button"
                onClick={() => onConfigChange(null)}
                className="text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Gỡ file SEB"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="border-border hover:border-primary/50 bg-background flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center transition-colors">
              {uploading ? (
                <Loader2 className="text-primary mb-2 h-6 w-6 animate-spin" />
              ) : (
                <UploadCloud className="text-muted-foreground mb-2 h-6 w-6" />
              )}
              <span className="text-sm font-semibold">
                {uploading ? 'Đang tải lên...' : 'Tải file cấu hình (.seb)'}
              </span>
              <span className="text-muted-foreground mt-1 text-xs">
                Xuất từ SEB Configuration Tool, trỏ URL bắt đầu về chính bài này.
              </span>
              <input
                type="file"
                accept=".seb,application/seb"
                className="hidden"
                disabled={uploading}
                onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
          {!config && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Chưa có file cấu hình — học sinh sẽ không có nút mở Safe Exam Browser.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
