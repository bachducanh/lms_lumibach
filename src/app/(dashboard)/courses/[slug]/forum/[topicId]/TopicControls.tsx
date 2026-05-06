'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateTopicAction, deleteTopicAction } from '@/actions/forum';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
      const result = await updateTopicAction(topicId, data);
      if (!result.success) { toast.error(result.error); return; }
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm('Xoá chủ đề này? Tất cả bài viết sẽ bị xoá.')) return;
    startTransition(async () => {
      const result = await deleteTopicAction(topicId);
      if (!result.success) { toast.error(result.error); return; }
      toast.success('Đã xoá chủ đề');
      router.push(`/courses/${slug}/forum`);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent transition-colors disabled:opacity-50 shrink-0 outline-none" disabled={isPending}>
        <MoreVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => toggle({ isPinned: !isPinned })}>
          {isPinned ? <PinOff className="h-4 w-4 mr-2" /> : <Pin className="h-4 w-4 mr-2" />}
          {isPinned ? 'Bỏ ghim' : 'Ghim chủ đề'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggle({ isLocked: !isLocked })}>
          {isLocked ? <Unlock className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
          {isLocked ? 'Mở khoá' : 'Khoá chủ đề'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Xoá chủ đề
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
