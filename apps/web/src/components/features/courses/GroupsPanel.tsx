'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, UserPlus, Shuffle, X, Pencil, Layers } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import {
  GROUP_MODES,
  type CourseGroupsData,
  type CourseMember,
  type GroupItem,
  type GroupModeValue,
  type GroupingItem,
} from '@lumibach/types';
import { cn } from '@/lib/utils';

type Props = {
  courseId: string;
  canManage: boolean;
  data: CourseGroupsData;
  students: CourseMember[];
};

function displayName(u: { fullName: string | null; firstName: string; lastName: string }) {
  return u.fullName ?? `${u.firstName} ${u.lastName}`.trim();
}

export function GroupsPanel({ courseId, canManage, data, students }: Props) {
  const router = useRouter();
  const [confirmDialog, openConfirm] = useConfirmDialog();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const activeStudents = students.filter((s) => s.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      {confirmDialog}

      <ModeSelector
        courseId={courseId}
        canManage={canManage}
        mode={data.groupMode}
        onSaved={refresh}
      />

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <AddGroupButton courseId={courseId} onSaved={refresh} />
          <AutoDistributeButton courseId={courseId} onSaved={refresh} />
        </div>
      )}

      {/* Groups */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Nhóm ({data.groups.length})</h3>
        {data.groups.length === 0 ? (
          <p className="text-muted-foreground text-sm">Chưa có nhóm nào.</p>
        ) : (
          data.groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              canManage={canManage}
              students={activeStudents}
              onChanged={refresh}
              openConfirm={openConfirm}
            />
          ))
        )}
      </div>

      {/* Groupings */}
      <GroupingsSection
        courseId={courseId}
        canManage={canManage}
        groupings={data.groupings}
        groups={data.groups}
        onChanged={refresh}
        openConfirm={openConfirm}
      />
    </div>
  );
}

// ── Mode selector ──────────────────────────────────────────────

function ModeSelector({
  courseId,
  canManage,
  mode,
  onSaved,
}: {
  courseId: string;
  canManage: boolean;
  mode: GroupModeValue;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function setMode(next: GroupModeValue) {
    if (next === mode) return;
    startTransition(async () => {
      try {
        await apiClient.patch(`/courses/${courseId}/group-mode`, { groupMode: next });
        toast.success('Đã cập nhật chế độ nhóm.');
        onSaved();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi cập nhật chế độ');
      }
    });
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Chế độ tương tác nhóm</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {GROUP_MODES.map((m) => {
          const active = m.value === mode;
          return (
            <button
              key={m.value}
              type="button"
              disabled={!canManage || pending}
              onClick={() => setMode(m.value)}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                active
                  ? 'border-primary bg-primary/10 ring-primary/30 ring-1'
                  : 'border-border bg-card hover:border-primary/40',
                !canManage && 'cursor-default opacity-90'
              )}
            >
              <p className="text-sm font-semibold">{m.label}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">{m.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Add group ──────────────────────────────────────────────────

function AddGroupButton({ courseId, onSaved }: { courseId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        await apiClient.post(`/courses/${courseId}/groups`, { name: name.trim() });
        toast.success('Đã thêm nhóm.');
        setName('');
        setOpen(false);
        onSaved();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi thêm nhóm');
      }
    });
  }

  if (!open)
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-4 w-4" /> Thêm nhóm
      </Button>
    );

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        autoFocus
        placeholder="Tên nhóm"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-9 w-48"
      />
      <Button type="submit" size="sm" disabled={pending}>
        Thêm
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Huỷ
      </Button>
    </form>
  );
}

// ── Auto distribute ────────────────────────────────────────────

function AutoDistributeButton({ courseId, onSaved }: { courseId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [groupCount, setGroupCount] = useState('4');
  const [groupingName, setGroupingName] = useState('Phân nhóm 1');
  const [random, setRandom] = useState(true);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const count = parseInt(groupCount, 10);
    if (isNaN(count) || count < 1) {
      toast.error('Số nhóm không hợp lệ.');
      return;
    }
    startTransition(async () => {
      try {
        await apiClient.post(`/courses/${courseId}/groups/auto`, {
          groupCount: count,
          groupingName: groupingName.trim() || 'Phân nhóm',
          random,
        });
        toast.success('Đã chia nhóm tự động.');
        setOpen(false);
        onSaved();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi chia nhóm');
      }
    });
  }

  if (!open)
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Shuffle className="mr-1.5 h-4 w-4" /> Chia nhóm tự động
      </Button>
    );

  return (
    <Card className="w-full">
      <CardContent className="space-y-3 pt-4">
        <form onSubmit={submit} className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground text-xs">Số nhóm</span>
              <Input
                type="number"
                min={1}
                value={groupCount}
                onChange={(e) => setGroupCount(e.target.value)}
                className="h-9 w-24"
              />
            </label>
            <label className="flex-1 space-y-1 text-sm">
              <span className="text-muted-foreground text-xs">Tên phân nhóm</span>
              <Input
                value={groupingName}
                onChange={(e) => setGroupingName(e.target.value)}
                className="h-9"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={random} onChange={(e) => setRandom(e.target.checked)} />
            Xếp học sinh ngẫu nhiên (bỏ chọn để tự xếp thủ công sau)
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Đang chia…' : 'Chia nhóm'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Group card ─────────────────────────────────────────────────

function GroupCard({
  group,
  canManage,
  students,
  onChanged,
  openConfirm,
}: {
  group: GroupItem;
  canManage: boolean;
  students: CourseMember[];
  onChanged: () => void;
  openConfirm: (msg: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [addId, setAddId] = useState('');
  const [, startTransition] = useTransition();

  const memberIds = new Set(group.members.map((m) => m.userId));
  const available = students.filter((s) => !memberIds.has(s.userId));

  function addMember(userId: string) {
    if (!userId) return;
    startTransition(async () => {
      try {
        await apiClient.post(`/groups/${group.id}/members`, { userIds: [userId] });
        setAddId('');
        onChanged();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi thêm thành viên');
      }
    });
  }

  function removeMember(userId: string) {
    startTransition(async () => {
      try {
        await apiClient.delete(`/groups/${group.id}/members/${userId}`);
        onChanged();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi xoá thành viên');
      }
    });
  }

  function saveName() {
    startTransition(async () => {
      try {
        await apiClient.patch(`/groups/${group.id}`, { name: name.trim() });
        setEditing(false);
        onChanged();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi đổi tên');
      }
    });
  }

  async function del() {
    const ok = await openConfirm(`Xoá nhóm “${group.name}”?`);
    if (!ok) return;
    startTransition(async () => {
      try {
        await apiClient.delete(`/groups/${group.id}`);
        toast.success('Đã xoá nhóm.');
        onChanged();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi xoá nhóm');
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          {editing ? (
            <div className="flex flex-1 gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
              <Button size="sm" onClick={saveName}>
                Lưu
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Huỷ
              </Button>
            </div>
          ) : (
            <CardTitle className="flex items-center gap-2 text-base">
              {group.name}
              <Badge variant="secondary">{group.members.length}</Badge>
            </CardTitle>
          )}
          {canManage && !editing && (
            <div className="flex gap-1">
              <button
                onClick={() => setEditing(true)}
                className="text-muted-foreground hover:text-foreground p-1"
                title="Đổi tên"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={del}
                className="text-muted-foreground hover:text-destructive p-1"
                title="Xoá nhóm"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {group.members.length === 0 ? (
          <p className="text-muted-foreground text-sm">Chưa có thành viên.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {group.members.map((m) => (
              <li
                key={m.id}
                className="bg-muted/50 flex items-center gap-1.5 rounded-full py-1 pr-1 pl-2.5 text-xs"
              >
                <span>{displayName(m.user)}</span>
                {canManage && (
                  <button
                    onClick={() => removeMember(m.userId)}
                    className="hover:bg-destructive/20 hover:text-destructive rounded-full p-0.5"
                    title="Xoá khỏi nhóm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && available.length > 0 && (
          <div className="flex items-center gap-2">
            <UserPlus className="text-muted-foreground h-4 w-4" />
            <select
              value={addId}
              onChange={(e) => addMember(e.target.value)}
              className="border-input bg-background h-9 flex-1 rounded-md border px-2 text-sm"
            >
              <option value="">+ Thêm thành viên…</option>
              {available.map((s) => (
                <option key={s.userId} value={s.userId}>
                  {displayName(s.user)}
                </option>
              ))}
            </select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Groupings ──────────────────────────────────────────────────

function GroupingsSection({
  courseId,
  canManage,
  groupings,
  groups,
  onChanged,
  openConfirm,
}: {
  courseId: string;
  canManage: boolean;
  groupings: GroupingItem[];
  groups: GroupItem[];
  onChanged: () => void;
  openConfirm: (msg: string) => Promise<boolean>;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const groupName = new Map(groups.map((g) => [g.id, g.name]));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        await apiClient.post(`/courses/${courseId}/groupings`, {
          name: name.trim(),
          groupIds: [...selected],
        });
        toast.success('Đã tạo phân nhóm.');
        setName('');
        setSelected(new Set());
        setCreating(false);
        onChanged();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi tạo phân nhóm');
      }
    });
  }

  async function del(g: GroupingItem) {
    const ok = await openConfirm(`Xoá phân nhóm “${g.name}”?`);
    if (!ok) return;
    startTransition(async () => {
      try {
        await apiClient.delete(`/groupings/${g.id}`);
        toast.success('Đã xoá phân nhóm.');
        onChanged();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi xoá phân nhóm');
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Layers className="h-4 w-4" /> Phân nhóm ({groupings.length})
        </h3>
        {canManage && groups.length > 0 && !creating && (
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Tạo phân nhóm
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        Phân nhóm là tập hợp nhiều nhóm nhỏ — dùng để giao chung một hoạt động cho các nhóm.
      </p>

      {canManage && creating && (
        <Card>
          <CardContent className="space-y-3 pt-4">
            <form onSubmit={create} className="space-y-3">
              <Input
                autoFocus
                placeholder="Tên phân nhóm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Chọn các nhóm thuộc phân nhóm này:</p>
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => (
                    <label
                      key={g.id}
                      className="hover:bg-muted/40 flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(g.id)}
                        onChange={() => toggle(g.id)}
                      />
                      {g.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  Tạo
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
                  Huỷ
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {groupings.length === 0 ? (
        <p className="text-muted-foreground text-sm">Chưa có phân nhóm.</p>
      ) : (
        <ul className="space-y-2">
          {groupings.map((g) => (
            <li
              key={g.id}
              className="border-border bg-card flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div>
                <p className="text-sm font-medium">{g.name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {g.groupIds.length === 0 ? (
                    <span className="text-muted-foreground text-xs">Chưa gán nhóm</span>
                  ) : (
                    g.groupIds.map((id) => (
                      <Badge key={id} variant="outline" className="text-xs">
                        {groupName.get(id) ?? '—'}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              {canManage && (
                <button
                  onClick={() => del(g)}
                  className="text-muted-foreground hover:text-destructive p-1"
                  title="Xoá"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
