'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ClipboardList, Brain, Code2, FileQuestion, RotateCcw, Trash2 } from 'lucide-react';
import { TRASHED_ACTIVITY_LABEL } from '@lumibach/types';
import type { TrashedActivityItem, TrashedActivityKind } from '@lumibach/types';
import { restoreActivityAction, purgeActivityAction } from '@/app/(dashboard)/admin/trash/actions';

const KIND_ICON: Record<TrashedActivityKind, typeof ClipboardList> = {
  assignment: ClipboardList,
  quiz: Brain,
  'code-exercise': Code2,
  'practice-test': FileQuestion,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function TrashedActivityList({ activities }: { activities: TrashedActivityItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDialog, openConfirm] = useConfirmDialog();

  function handleRestore(item: TrashedActivityItem) {
    setBusyId(item.id);
    startTransition(async () => {
      const res = await restoreActivityAction(item.kind, item.id);
      setBusyId(null);
      if ('error' in res) toast.error(res.error);
      else {
        toast.success(res.message);
        router.refresh();
      }
    });
  }

  async function handlePurge(item: TrashedActivityItem) {
    const warning =
      item.submissionCount > 0
        ? ` Kèm theo ${item.submissionCount} bài làm của học sinh sẽ mất vĩnh viễn.`
        : '';
    const ok = await openConfirm(
      `Xoá vĩnh viễn "${item.title}"?${warning} Thao tác này không hoàn tác được.`
    );
    if (!ok) return;

    setBusyId(item.id);
    startTransition(async () => {
      const res = await purgeActivityAction(item.kind, item.id);
      setBusyId(null);
      if ('error' in res) toast.error(res.error);
      else {
        toast.success('Đã xoá vĩnh viễn.');
        router.refresh();
      }
    });
  }

  if (activities.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-xl border border-dashed py-12 text-center text-sm">
        Không có hoạt động nào trong thùng rác.
      </div>
    );
  }

  return (
    <>
      {confirmDialog}
      <div className="divide-border border-border bg-card divide-y overflow-hidden rounded-xl border">
        {activities.map((item) => {
          const Icon = KIND_ICON[item.kind];
          const busy = pending && busyId === item.id;
          return (
            <div
              key={`${item.kind}-${item.id}`}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <div className="bg-muted/50 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <Icon className="text-muted-foreground h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {TRASHED_ACTIVITY_LABEL[item.kind]}
                  </Badge>
                  {item.submissionCount > 0 && (
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {item.submissionCount} bài làm
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {item.courseName} · xoá ngày {formatDate(item.deletedAt)} ·{' '}
                  {item.daysLeft > 0 ? (
                    <>còn {item.daysLeft} ngày trước khi tự xoá</>
                  ) : (
                    <span className="text-destructive">sẽ xoá ở lần dọn kế tiếp</span>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleRestore(item)}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Khôi phục
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => handlePurge(item)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
