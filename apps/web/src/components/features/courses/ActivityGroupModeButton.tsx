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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiClient, ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { UsersRound, Layers, Users, EyeOff } from 'lucide-react';
import { type CourseGroupsData, type GroupItem, type GroupingItem } from '@lumibach/types';

type GroupModeValue = 'NO_GROUPS' | 'SEPARATE_GROUPS' | 'VISIBLE_GROUPS';

type Props = {
  courseId: string;
  moduleItemId: string;
  currentMode: GroupModeValue;
  currentGroupingId: string | null;
  currentGroupIds: string[];
  onChanged?: () => void;
  compact?: boolean; // chỉ icon (desktop toolbar)
  // Controlled mode: nếu open/onOpenChange được truyền → không render trigger riêng,
  // parent tự lo trigger (vd: DropdownMenuItem ở mobile).
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean; // default true
};

const MODE_META: Record<
  GroupModeValue,
  { label: string; description: string; icon: React.ReactNode; color: string }
> = {
  NO_GROUPS: {
    label: 'Không có nhóm',
    description: 'Mọi học sinh trong khoá đều xem được hoạt động này.',
    icon: <EyeOff className="h-4 w-4" />,
    color: 'text-slate-500',
  },
  VISIBLE_GROUPS: {
    label: 'Nhóm hiện hữu',
    description: 'Chỉ các nhóm được chọn có thể xem hoạt động này.',
    icon: <Users className="h-4 w-4" />,
    color: 'text-amber-500',
  },
  SEPARATE_GROUPS: {
    label: 'Phân nhóm',
    description:
      'Học sinh chia thành các nhóm theo một Phân nhóm — bài tập theo nhóm (1 nộp = cả nhóm).',
    icon: <Layers className="h-4 w-4" />,
    color: 'text-violet-500',
  },
};

export function ActivityGroupModeButton({
  courseId,
  moduleItemId,
  currentMode,
  currentGroupingId,
  currentGroupIds,
  onChanged,
  compact = false,
  open: openProp,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const [openLocal, setOpenLocal] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openLocal;
  const setOpen = (next: boolean) => {
    if (controlled) onOpenChange?.(next);
    else setOpenLocal(next);
  };
  const [mode, setMode] = useState<GroupModeValue>(currentMode);
  const [groupingId, setGroupingId] = useState<string | null>(currentGroupingId);
  const [groupIds, setGroupIds] = useState<Set<string>>(new Set(currentGroupIds));

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [groupings, setGroupings] = useState<GroupingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  // Reset local state khi prop thay đổi (sau refresh).
  useEffect(() => {
    setMode(currentMode);
    setGroupingId(currentGroupingId);
    setGroupIds(new Set(currentGroupIds));
  }, [currentMode, currentGroupingId, currentGroupIds]);

  // Lazy load groups + groupings khi mở dialog lần đầu.
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
        await apiClient.patch(`/modules/items/${moduleItemId}/group-settings`, body);
        toast.success(`Đã đặt: ${MODE_META[mode].label}`);
        setOpen(false);
        onChanged?.();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi lưu cài đặt nhóm');
      }
    });
  }

  const meta = MODE_META[currentMode];
  const summary =
    currentMode === 'NO_GROUPS'
      ? 'Mọi HS'
      : currentMode === 'VISIBLE_GROUPS'
        ? `${currentGroupIds.length} nhóm`
        : currentGroupingId
          ? 'Phân nhóm'
          : 'Phân nhóm (chưa chọn)';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger
          aria-label="Xác định kiểu nhóm"
          title={`${meta.label} — Bấm để đổi`}
          className={cn(
            'border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors outline-none focus-visible:ring-3',
            compact ? 'h-8 w-8 px-0' : 'px-3'
          )}
        >
          <UsersRound className={cn('h-4 w-4', meta.color)} />
          {!compact && (
            <>
              <span className="hidden md:inline">{meta.label}</span>
              <span className="text-muted-foreground hidden text-xs md:inline">· {summary}</span>
            </>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UsersRound className="text-primary h-5 w-5" />
            Chế độ nhóm cho hoạt động
          </DialogTitle>
          <DialogDescription>
            Quyết định ai xem được hoạt động này và có chia nhóm trong hoạt động hay không.
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
                  name="group-mode"
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
                              name="grouping"
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
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Huỷ
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
