'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiClient, ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { UsersRound, Layers, Users, EyeOff } from 'lucide-react';
import type { CourseGroupsData, GroupItem, GroupingItem } from '@lumibach/types';

type GroupModeValue = 'NO_GROUPS' | 'SEPARATE_GROUPS' | 'VISIBLE_GROUPS';

type Props = {
  courseId: string;
  moduleId: string;
  /** Số hoạt động hiện có trong chương để hiển thị xác nhận. */
  itemCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
};

const MODE_META: Record<
  GroupModeValue,
  { label: string; description: string; icon: React.ReactNode; color: string }
> = {
  NO_GROUPS: {
    label: 'Không có nhóm',
    description: 'Mọi học sinh trong khoá đều xem được toàn bộ hoạt động của chương.',
    icon: <EyeOff className="h-4 w-4" />,
    color: 'text-slate-500',
  },
  VISIBLE_GROUPS: {
    label: 'Nhóm hiện hữu',
    description: 'Chỉ các nhóm được chọn có thể xem các hoạt động của chương.',
    icon: <Users className="h-4 w-4" />,
    color: 'text-amber-500',
  },
  SEPARATE_GROUPS: {
    label: 'Phân nhóm',
    description:
      'Học sinh chia thành các nhóm theo một Phân nhóm — bài tập theo nhóm (1 nộp = cả nhóm) cho mọi hoạt động.',
    icon: <Layers className="h-4 w-4" />,
    color: 'text-violet-500',
  },
};

export function ModuleGroupModeButton({
  courseId,
  moduleId,
  itemCount,
  open,
  onOpenChange,
  onChanged,
}: Props) {
  const [mode, setMode] = useState<GroupModeValue>('NO_GROUPS');
  const [groupingId, setGroupingId] = useState<string | null>(null);
  const [groupIds, setGroupIds] = useState<Set<string>>(new Set());

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [groupings, setGroupings] = useState<GroupingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  // Reset state mỗi lần mở dialog (vì module chưa có cột group riêng,
  // không có "current state" để hiển thị — luôn bắt đầu lại).
  useEffect(() => {
    if (!open) return;
    setMode('NO_GROUPS');
    setGroupingId(null);
    setGroupIds(new Set());
  }, [open]);

  // Lazy load groups + groupings khi mở dialog.
  useEffect(() => {
    if (!open || groups.length > 0 || groupings.length > 0) return;
    setLoading(true);
    apiClient
      .get<CourseGroupsData>(`/courses/${courseId}/groups`)
      .then((data) => {
        setGroups(data.groups);
        setGroupings(data.groupings);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, courseId, groups.length, groupings.length]);

  function toggleGroup(id: string) {
    setGroupIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function save() {
    startTransition(async () => {
      try {
        const body: {
          groupMode: GroupModeValue;
          groupIds?: string[];
          groupingId?: string | null;
        } = { groupMode: mode };
        if (mode === 'VISIBLE_GROUPS') body.groupIds = [...groupIds];
        if (mode === 'SEPARATE_GROUPS') body.groupingId = groupingId;
        const res = await apiClient.patch<{ message: string; updatedItems: number }>(
          `/modules/${moduleId}/group-settings`,
          body
        );
        toast.success(res.message ?? 'Đã áp dụng chế độ nhóm cho chương.');
        onOpenChange(false);
        onChanged?.();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi lưu cài đặt nhóm.');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UsersRound className="text-primary h-5 w-5" />
            Chế độ nhóm cho cả chương
          </DialogTitle>
          <DialogDescription>
            Lựa chọn này sẽ áp dụng cho <strong>{itemCount} hoạt động</strong> hiện có trong chương.
            Nếu thêm hoạt động mới sau này, hãy mở lại để áp dụng tiếp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {(Object.keys(MODE_META) as GroupModeValue[]).map((value) => {
            const m = MODE_META[value];
            const active = mode === value;
            return (
              <label
                key={value}
                className={cn(
                  'group flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                  active
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40 hover:bg-accent/30'
                )}
              >
                <input
                  type="radio"
                  name="module-group-mode"
                  className="mt-1"
                  checked={active}
                  onChange={() => setMode(value)}
                />
                <span className="flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className={m.color}>{m.icon}</span>
                    {m.label}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
                    {m.description}
                  </span>

                  {value === 'VISIBLE_GROUPS' && active && (
                    <div className="border-border mt-2.5 space-y-1 rounded-md border p-2.5">
                      <p className="text-muted-foreground mb-1.5 text-[11px] font-medium uppercase">
                        Chọn nhóm được xem
                      </p>
                      {loading ? (
                        <p className="text-muted-foreground text-xs">Đang tải…</p>
                      ) : groups.length === 0 ? (
                        <p className="text-muted-foreground text-xs italic">
                          Khoá học chưa có nhóm — tạo ở tab "Nhóm" trong Thành viên.
                        </p>
                      ) : (
                        groups.map((g) => (
                          <label
                            key={g.id}
                            className="hover:bg-accent/40 flex items-center gap-2 rounded px-1 py-1 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={groupIds.has(g.id)}
                              onChange={() => toggleGroup(g.id)}
                            />
                            <span>{g.name}</span>
                            <span className="text-muted-foreground ml-auto">
                              {g.members.length} HS
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  )}

                  {value === 'SEPARATE_GROUPS' && active && (
                    <div className="border-border mt-2.5 space-y-1 rounded-md border p-2.5">
                      <p className="text-muted-foreground mb-1.5 text-[11px] font-medium uppercase">
                        Chọn phân nhóm áp dụng
                      </p>
                      {loading ? (
                        <p className="text-muted-foreground text-xs">Đang tải…</p>
                      ) : groupings.length === 0 ? (
                        <p className="text-muted-foreground text-xs italic">
                          Chưa có Phân nhóm — tạo Phân nhóm (gộp nhóm) ở tab "Nhóm".
                        </p>
                      ) : (
                        groupings.map((gr) => (
                          <label
                            key={gr.id}
                            className="hover:bg-accent/40 flex items-center gap-2 rounded px-1 py-1 text-xs"
                          >
                            <input
                              type="radio"
                              name="module-grouping"
                              checked={groupingId === gr.id}
                              onChange={() => setGroupingId(gr.id)}
                            />
                            <span>{gr.name}</span>
                            <span className="text-muted-foreground ml-auto">
                              {gr.groupIds.length} nhóm
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </span>
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Huỷ
          </Button>
          <Button onClick={save} disabled={pending || itemCount === 0}>
            {pending ? 'Đang lưu…' : `Áp dụng cho ${itemCount} hoạt động`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
