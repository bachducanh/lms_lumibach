'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Pin, PinOff, Lock, Unlock, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function TopicControls({
  topicId,
  slug,
  title,
  forumId,
  isPinned,
  isLocked,
  canModerate,
}: {
  topicId: string;
  slug: string;
  title: string;
  forumId: string | null;
  isPinned: boolean;
  isLocked: boolean;
  /** Ghim / khoá / xoá chỉ dành cho GV trở lên; tác giả chỉ đổi được tiêu đề. */
  canModerate: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);

  function saveTitle() {
    const clean = draftTitle.trim();
    if (clean.length < 5) {
      toast.error('Tiêu đề tối thiểu 5 ký tự.');
      return;
    }
    startTransition(async () => {
      try {
        await apiClient.patch(`/forum/topics/${topicId}`, { title: clean });
        toast.success('Đã đổi tiêu đề');
        setRenaming(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi đổi tiêu đề');
      }
    });
  }

  function toggle(data: { isPinned?: boolean; isLocked?: boolean }) {
    startTransition(async () => {
      try {
        await apiClient.patch(`/forum/topics/${topicId}`, data);
        router.refresh();
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Lỗi cập nhật chủ đề';
        toast.error(msg);
      }
    });
  }

  function handleDelete() {
    if (!confirm('Xoá chủ đề này? Tất cả bài viết sẽ bị xoá.')) return;
    startTransition(async () => {
      try {
        await apiClient.delete(`/forum/topics/${topicId}`);
        toast.success('Đã xoá chủ đề');
        router.push(`/courses/${slug}/forum${forumId ? `?forumId=${forumId}` : ''}`);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Lỗi xoá chủ đề';
        toast.error(msg);
      }
    });
  }

  if (renaming) {
    return (
      <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
        <Input
          autoFocus
          value={draftTitle}
          maxLength={200}
          onChange={(e) => setDraftTitle(e.target.value)}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={saveTitle} disabled={isPending}>
            Lưu
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraftTitle(title);
              setRenaming(false);
            }}
            disabled={isPending}
          >
            Huỷ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="hover:bg-accent inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors outline-none disabled:opacity-50"
        disabled={isPending}
      >
        <MoreVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setRenaming(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          Sửa tiêu đề
        </DropdownMenuItem>
        {!canModerate ? null : (
          <DropdownMenuItem onClick={() => toggle({ isPinned: !isPinned })}>
            {isPinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
            {isPinned ? 'Bỏ ghim' : 'Ghim chủ đề'}
          </DropdownMenuItem>
        )}
        {canModerate && (
          <DropdownMenuItem onClick={() => toggle({ isLocked: !isLocked })}>
            {isLocked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
            {isLocked ? 'Mở khoá' : 'Khoá chủ đề'}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Xoá chủ đề
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
