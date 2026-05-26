'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, X, NotebookPen } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { PortfolioReflectionItem } from '@lumibach/types';

type Props = {
  courseId: string;
  reflections: PortfolioReflectionItem[];
  canEdit: boolean;
};

function fmt(d: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));
}

export function ReflectionsPanel({ courseId, reflections, canEdit }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [confirmDialog, openConfirm] = useConfirmDialog();
  const refresh = () => router.refresh();

  return (
    <section className="space-y-3">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <NotebookPen className="h-4 w-4" /> Tự đánh giá / Phản ánh
        </h2>
        {canEdit && !adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Thêm
          </Button>
        )}
      </div>

      {canEdit && adding && (
        <ReflectionForm
          courseId={courseId}
          onDone={() => {
            setAdding(false);
            refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {reflections.length === 0 && !adding ? (
        <p className="text-muted-foreground text-sm">
          {canEdit ? 'Bạn chưa có mục tự đánh giá nào.' : 'Chưa có mục tự đánh giá.'}
        </p>
      ) : (
        <div className="space-y-2">
          {reflections.map((r) => (
            <ReflectionCard
              key={r.id}
              reflection={r}
              canEdit={canEdit}
              onChanged={refresh}
              openConfirm={openConfirm}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ReflectionCard({
  reflection,
  canEdit,
  onChanged,
  openConfirm,
}: {
  reflection: PortfolioReflectionItem;
  canEdit: boolean;
  onChanged: () => void;
  openConfirm: (msg: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  async function del() {
    const ok = await openConfirm('Xoá mục tự đánh giá này?');
    if (!ok) return;
    startTransition(async () => {
      try {
        await apiClient.delete(`/portfolio/reflections/${reflection.id}`);
        toast.success('Đã xoá.');
        onChanged();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi xoá');
      }
    });
  }

  if (editing) {
    return (
      <ReflectionForm
        courseId=""
        reflection={reflection}
        onDone={() => {
          setEditing(false);
          onChanged();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{reflection.title}</p>
          <p className="text-muted-foreground mt-1 text-sm whitespace-pre-line">
            {reflection.content}
          </p>
          <p className="text-muted-foreground mt-2 text-xs">{fmt(reflection.createdAt)}</p>
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => setEditing(true)}
              className="text-muted-foreground hover:text-foreground p-1"
              title="Sửa"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={del}
              className="text-muted-foreground hover:text-destructive p-1"
              title="Xoá"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReflectionForm({
  courseId,
  reflection,
  onDone,
  onCancel,
}: {
  courseId: string;
  reflection?: PortfolioReflectionItem;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(reflection?.title ?? '');
  const [content, setContent] = useState(reflection?.content ?? '');
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('Nhập tiêu đề và nội dung.');
      return;
    }
    startTransition(async () => {
      try {
        if (reflection) {
          await apiClient.patch(`/portfolio/reflections/${reflection.id}`, {
            title: title.trim(),
            content: content.trim(),
          });
          toast.success('Đã cập nhật.');
        } else {
          await apiClient.post(`/courses/${courseId}/portfolio/reflections`, {
            title: title.trim(),
            content: content.trim(),
          });
          toast.success('Đã thêm tự đánh giá.');
        }
        onDone();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Có lỗi xảy ra');
      }
    });
  }

  return (
    <form onSubmit={submit} className="border-border bg-card space-y-2 rounded-lg border p-4">
      <Input
        autoFocus
        placeholder="Tiêu đề (vd: Tự đánh giá tuần 5)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Textarea
        placeholder="Em đã học được gì, làm tốt điều gì, cần cải thiện điều gì…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Đang lưu…' : reflection ? 'Lưu' : 'Thêm'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="mr-1 h-4 w-4" /> Huỷ
        </Button>
      </div>
    </form>
  );
}
