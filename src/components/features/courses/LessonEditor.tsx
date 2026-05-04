'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';

const RichTextEditor = dynamic(
  () => import('@/components/ui/editor/RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
  {
    ssr: false,
    loading: () => <div className="h-64 rounded-xl bg-muted/30 animate-pulse" />,
  },
);
import { LessonAttachments } from '@/components/features/courses/LessonAttachments';
import { toast } from 'sonner';
import { createLessonAction, updateLessonAction, type LessonFormValues } from '@/actions/lessons';
import type { AttachmentDTO } from '@/actions/attachments';
import { ChevronLeft, Clock, Paperclip } from 'lucide-react';

type Props =
  | { mode: 'create'; courseSlug: string; courseId: string; moduleId: string; lesson?: undefined; attachments?: undefined }
  | { mode: 'edit'; courseSlug: string; courseId: string; moduleId: string; lesson: { id: string; title: string; content: string; estimatedMinutes: number | null }; attachments: AttachmentDTO[] };

export function LessonEditor({ mode, courseSlug, courseId, moduleId, lesson, attachments }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(lesson?.title ?? '');
  const [content, setContent] = useState(lesson?.content ?? '');
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>(
    lesson?.estimatedMinutes ? String(lesson.estimatedMinutes) : '',
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const values: LessonFormValues = {
      title,
      content,
      estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
    };

    startTransition(async () => {
      const res =
        mode === 'create'
          ? await createLessonAction(courseId, moduleId, values)
          : await updateLessonAction(lesson!.id, values);

      if (res.success) {
        toast.success(res.message);
        const destId = mode === 'create' ? res.data?.lessonId : lesson!.id;
        router.push(destId
          ? `/courses/${courseSlug}/lessons/${destId}`
          : `/courses/${courseSlug}/modules`);
      } else {
        toast.error(res.error);
      }
    });
  }

  const saveLabel = pending
    ? 'Đang lưu...'
    : mode === 'create'
      ? 'Tạo bài giảng'
      : 'Lưu thay đổi';

  return (
    <form onSubmit={handleSubmit}>
      {/* ── Sticky action bar ─────────────────────────────── */}
      <div className="-mx-6 -mt-6 mb-8 flex h-14 items-center gap-3 border-b bg-muted/20 px-4">
        <Link
          href={`/courses/${courseSlug}/modules`}
          className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Nội dung
        </Link>

        <span className="mx-2 h-4 w-px bg-border" />

        <p className="flex-1 truncate text-sm font-medium text-muted-foreground">
          {title.trim() || (mode === 'create' ? 'Bài giảng mới' : 'Chưa có tiêu đề')}
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push(mode === 'edit' && lesson ? `/courses/${courseSlug}/lessons/${lesson.id}` : `/courses/${courseSlug}/modules`)}
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
          className="w-full bg-transparent text-3xl font-bold leading-tight tracking-tight outline-none placeholder:text-muted-foreground/30 focus:placeholder:text-muted-foreground/50"
        />

        {/* Duration — inline compact */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>Thời gian ước tính:</span>
          <input
            type="number"
            min={1}
            max={300}
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(e.target.value)}
            placeholder="—"
            className="w-14 rounded border border-transparent bg-transparent text-center text-sm outline-none transition-colors hover:border-border focus:border-primary focus:bg-muted/30"
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
        <div className="mt-8 rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            File đính kèm
          </h3>
          <LessonAttachments
            lessonId={lesson.id}
            initialAttachments={attachments ?? []}
            canEdit
          />
        </div>
      )}

      {/* ── Bottom save (for extra-long pages) ───────────── */}
      <div className="mt-8 flex items-center justify-end gap-2 border-t border-border pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(mode === 'edit' && lesson ? `/courses/${courseSlug}/lessons/${lesson.id}` : `/courses/${courseSlug}/modules`)}
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
