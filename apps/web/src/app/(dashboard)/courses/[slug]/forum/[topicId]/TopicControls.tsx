'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Pin, PinOff, Lock, Unlock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function TopicControls({
  topicId,
  slug,
  isPinned,
  isLocked,
}: {
  topicId: string;
  slug: string;
  isPinned: boolean;
  isLocked: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
        router.push(`/courses/${slug}/forum`);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Lỗi xoá chủ đề';
        toast.error(msg);
      }
    });
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
        <DropdownMenuItem onClick={() => toggle({ isPinned: !isPinned })}>
          {isPinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
          {isPinned ? 'Bỏ ghim' : 'Ghim chủ đề'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggle({ isLocked: !isLocked })}>
          {isLocked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
          {isLocked ? 'Mở khoá' : 'Khoá chủ đề'}
        </DropdownMenuItem>
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
