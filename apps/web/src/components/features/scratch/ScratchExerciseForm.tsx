'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Sb3Upload } from './Sb3Upload';
import { apiClient } from '@/lib/api-client';

type Props =
  | {
      mode: 'create';
      courseId: string;
      courseSlug: string;
      moduleId: string | null;
    }
  | {
      mode: 'edit';
      exerciseId: string;
      courseSlug: string;
      initial: {
        title: string;
        description: string | null;
        starterFileUrl: string | null;
        status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
      };
    };

export function ScratchExerciseForm(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initialTitle = props.mode === 'edit' ? props.initial.title : '';
  const initialDesc = props.mode === 'edit' ? (props.initial.description ?? '') : '';
  const initialFile = props.mode === 'edit' ? props.initial.starterFileUrl : null;
  const initialStatus = props.mode === 'edit' ? props.initial.status : 'DRAFT';

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDesc);
  const [starterUrl, setStarterUrl] = useState<string | null>(initialFile);
  const [starterName, setStarterName] = useState<string | null>(null);
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED' | 'CLOSED'>(initialStatus);

  function handleSave() {
    if (!title.trim()) {
      toast.error('Tiêu đề không được để trống.');
      return;
    }
    startTransition(async () => {
      try {
        if (props.mode === 'create') {
          const res = await apiClient.post<{ exerciseId: string }>('/scratch', {
            courseId: props.courseId,
            title: title.trim(),
            description: description.trim() || undefined,
            starterFileUrl: starterUrl ?? undefined,
            moduleId: props.moduleId ?? undefined,
          });
          toast.success('Đã tạo.');
          router.push(`/courses/${props.courseSlug}/scratch/${res.exerciseId}`);
        } else {
          await apiClient.patch(`/scratch/${props.exerciseId}`, {
            title: title.trim(),
            description: description.trim() || null,
            starterFileUrl: starterUrl ?? null,
            status,
          });
          toast.success('Đã cập nhật.');
          router.push(`/courses/${props.courseSlug}/scratch/${props.exerciseId}`);
          router.refresh();
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Tiêu đề bài
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ví dụ: Bài 1 — Mèo đi vòng quanh"
          className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Mô tả / Đề bài (tuỳ chọn)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Yêu cầu của bài, gợi ý..."
          className="border-input bg-background focus:ring-ring w-full resize-y rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
        />
      </div>

      {/* Starter .sb3 */}
      <div className="space-y-1.5">
        <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Project khởi đầu (.sb3 — tuỳ chọn)
        </label>
        <p className="text-muted-foreground text-[11px]">
          Tải lên project Scratch khởi đầu để học sinh không phải làm từ blank. Nếu trống, học sinh
          bắt đầu với mèo Scratch mặc định.
        </p>
        <Sb3Upload
          kind="starter"
          onUploaded={(url, name) => {
            setStarterUrl(url || null);
            setStarterName(name || null);
          }}
          initialUrl={initialFile}
        />
        {starterName && !initialFile && (
          <p className="text-xs text-emerald-500">Sẽ dùng làm project khởi đầu cho học sinh.</p>
        )}
      </div>

      {/* Status (edit mode only) */}
      {props.mode === 'edit' && (
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Trạng thái
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
          >
            <option value="DRAFT">Nháp (Draft)</option>
            <option value="PUBLISHED">Công bố (Published)</option>
            <option value="CLOSED">Đóng (Closed)</option>
          </select>
        </div>
      )}

      <div className="border-border flex items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Huỷ
        </Button>
        <Button type="button" onClick={handleSave} disabled={pending}>
          {pending ? 'Đang lưu...' : props.mode === 'create' ? 'Tạo bài' : 'Lưu thay đổi'}
        </Button>
      </div>
    </div>
  );
}
