'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { UsersRound } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import type { CourseGroupsData, GroupingItem } from '@lumibach/types';

type Props = {
  assignmentId: string;
  courseId: string;
  initialEnabled: boolean;
  initialGroupingId: string | null;
};

export function GroupSubmissionPanel({
  assignmentId,
  courseId,
  initialEnabled,
  initialGroupingId,
}: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [groupingId, setGroupingId] = useState(initialGroupingId ?? '');
  const [groupings, setGroupings] = useState<GroupingItem[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    apiClient
      .get<CourseGroupsData>(`/courses/${courseId}/groups`)
      .then((d) => setGroupings(d.groupings))
      .catch(() => {});
  }, [courseId]);

  function save() {
    if (enabled && !groupingId) {
      toast.error('Chọn phân nhóm để nộp bài theo nhóm.');
      return;
    }
    startTransition(async () => {
      try {
        await apiClient.patch(`/assignments/${assignmentId}`, {
          groupSubmission: enabled,
          groupingId: enabled ? groupingId : null,
        });
        toast.success('Đã lưu cài đặt nộp bài theo nhóm.');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi lưu cài đặt');
      }
    });
  }

  return (
    <div className="border-border bg-card space-y-3 rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <UsersRound className="text-primary h-4 w-4" />
        <p className="text-sm font-semibold">Nộp bài theo nhóm</p>
      </div>
      <p className="text-muted-foreground text-xs">
        Khi bật, một thành viên nộp bài thì cả nhóm được tính là đã nộp; chấm điểm một lần áp dụng
        cho toàn nhóm.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Bật nộp bài theo nhóm
      </label>

      {enabled && (
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs">Phân nhóm áp dụng</label>
          <select
            value={groupingId}
            onChange={(e) => setGroupingId(e.target.value)}
            className="border-input bg-background h-9 w-full max-w-sm rounded-md border px-2 text-sm"
          >
            <option value="">— Chọn phân nhóm —</option>
            {groupings.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {groupings.length === 0 && (
            <p className="text-muted-foreground text-xs">
              Chưa có phân nhóm. Tạo ở mục Thành viên → tab Nhóm.
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? 'Đang lưu…' : 'Lưu'}
        </Button>
      </div>
    </div>
  );
}
