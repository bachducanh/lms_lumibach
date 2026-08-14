'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';

const RichTextEditor = dynamic(
  () =>
    import('@/components/ui/editor/RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
  {
    ssr: false,
    loading: () => <div className="bg-muted/30 h-64 animate-pulse rounded-xl" />,
  }
);
import { LessonAttachments } from '@/components/features/courses/LessonAttachments';
import { toast } from 'sonner';
import { apiClient, ApiError } from '@/lib/api-client';
import type { AttachmentDTO } from '@lumibach/types';
import { ChevronLeft, Clock, Paperclip } from 'lucide-react';

/**
 * Bài giảng soạn được ở hai nơi, và chỗ khác nhau duy nhất là điểm đến khi lưu:
 *   - `course` — chương của một khoá học (đường cũ)
 *   - `bank`   — chương trong ngân hàng nội dung của một danh mục
 * Nội dung soạn thảo, đính kèm, nút bấm đều dùng chung.
 */
type Owner =
  | { kind: 'course'; courseSlug: string; courseId: string }
  | { kind: 'bank'; categoryId: string };

type Props =
  | {
      mode: 'create';
      owner: Owner;
      moduleId: string;
      lesson?: undefined;
      attachments?: undefined;
    }
  | {
      mode: 'edit';
      owner: Owner;
      moduleId: string;
      lesson: { id: string; title: string; content: string; estimatedMinutes: number | null };
      attachments: AttachmentDTO[];
    };

export function LessonEditor({ mode, owner, moduleId, lesson, attachments }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(lesson?.title ?? '');
  const [content, setContent] = useState(lesson?.content ?? '');
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>(
    lesson?.estimatedMinutes ? String(lesson.estimatedMinutes) : ''
  );

  // Hai điểm đến duy nhất khác nhau giữa hai nơi soạn: chỗ quay lại khi huỷ, và
  // chỗ tới sau khi lưu.
  const backHref =
    owner.kind === 'bank'
      ? `/question-banks/${owner.categoryId}/content`
      : `/courses/${owner.courseSlug}/modules`;
  const afterSaveHref =
    owner.kind === 'bank'
      ? backHref
      : mode === 'edit' && lesson
        ? `/courses/${owner.courseSlug}/lessons/${lesson.id}`
        : backHref;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        if (mode === 'create') {
          const payload = {
            moduleId,
            title,
            content,
            estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
          };
          if (owner.kind === 'bank') {
            await apiClient.post(`/modules/bank-modules/${moduleId}/lessons`, payload);
          } else {
            await apiClient.post('/lessons', { courseId: owner.courseId, ...payload });
          }
          toast.success('Đã tạo bài giảng.');
          router.push(afterSaveHref);
        } else {
          await apiClient.patch(`/lessons/${lesson!.id}`, {
            title,
            content,
            estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
          });
          toast.success('Đã cập nhật bài giảng.');
          router.push(afterSaveHref);
        }
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi lưu bài giảng');
      }
    });
  }

  const saveLabel = pending ? 'Đang lưu...' : mode === 'create' ? 'Tạo bài giảng' : 'Lưu thay đổi';

  return (
    <form onSubmit={handleSubmit}>
      {/* ── Sticky action bar ─────────────────────────────── */}
      <div className="bg-muted/20 -mx-6 -mt-6 mb-8 flex h-14 items-center gap-3 border-b px-4">
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Nội dung
        </Link>

        <span className="bg-border mx-2 h-4 w-px" />

        <p className="text-muted-foreground flex-1 truncate text-sm font-medium">
          {title.trim() || (mode === 'create' ? 'Bài giảng mới' : 'Chưa có tiêu đề')}
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push(afterSaveHref)}
            disabled={pending}
          >
            Huỷ
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {saveLabel}
          </Button>
        </div>
      </div>

      {/* ── Metadata ──────────────────────────────────────── */}
      <div className="mb-6 space-y-3">
        {/* Title — big, editorial-style */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tiêu đề bài giảng..."
          required
          className="placeholder:text-muted-foreground/30 focus:placeholder:text-muted-foreground/50 w-full bg-transparent text-3xl leading-tight font-bold tracking-tight outline-none"
        />

        {/* Duration — inline compact */}
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>Thời gian ước tính:</span>
          <input
            type="number"
            min={1}
            max={300}
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(e.target.value)}
            placeholder="—"
            className="hover:border-border focus:border-primary focus:bg-muted/30 w-14 rounded border border-transparent bg-transparent text-center text-sm transition-colors outline-none"
          />
          <span>phút</span>
        </div>
      </div>

      {/* ── Editor ────────────────────────────────────────── */}
      <RichTextEditor
        content={content}
        onChange={setContent}
        placeholder="Bắt đầu viết nội dung bài giảng..."
      />

      {/* ── Attachments (edit mode only) ──────────────────── */}
      {mode === 'edit' && lesson && (
        <div className="border-border bg-card mt-8 rounded-xl border p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Paperclip className="text-muted-foreground h-4 w-4" />
            File đính kèm
          </h3>
          <LessonAttachments lessonId={lesson.id} initialAttachments={attachments ?? []} canEdit />
        </div>
      )}

      {/* ── Bottom save (for extra-long pages) ───────────── */}
      <div className="border-border mt-8 flex items-center justify-end gap-2 border-t pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(mode === 'edit' && lesson ? afterSaveHref : backHref)}
          disabled={pending}
        >
          Huỷ
        </Button>
        <Button type="submit" disabled={pending}>
          {saveLabel}
        </Button>
      </div>
    </form>
  );
}
