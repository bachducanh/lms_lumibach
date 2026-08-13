'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, Check, Loader2, PackageCheck } from 'lucide-react';
import {
  vnDateTimeLabel,
  vnRangeLabel,
  type BulkApproveResult,
  type PendingEquipmentBookingItem,
} from '@lumibach/types';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { EquipmentBookingDetailDialog } from './EquipmentBookingDetailDialog';

export function PendingEquipmentBookingsQueue({
  bookings,
}: {
  bookings: PendingEquipmentBookingItem[];
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allSelected = bookings.length > 0 && selectedIds.size === bookings.length;
  const selectedHasIssues = bookings.some(
    (booking) => selectedIds.has(booking.id) && booking.availabilityIssues.length > 0
  );

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulkApprove() {
    startTransition(async () => {
      try {
        const result = await apiClient.post<BulkApproveResult>('/equipment-bookings/bulk-approve', {
          ids: [...selectedIds],
        });
        if (result.failed.length === 0) {
          toast.success(`Đã duyệt ${result.approved.length} đơn thiết bị`);
        } else {
          toast.warning(
            `Duyệt được ${result.approved.length} đơn, ${result.failed.length} đơn lỗi: ` +
              result.failed.map((item) => item.reason).join(' · ')
          );
        }
        setSelectedIds(new Set());
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Không duyệt được, thử lại sau.');
      }
    });
  }

  if (bookings.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center">
        <PackageCheck className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p className="font-medium">Không có đơn thiết bị nào chờ duyệt</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary h-4 w-4"
            checked={allSelected}
            onChange={(e) =>
              setSelectedIds(
                e.target.checked ? new Set(bookings.map((booking) => booking.id)) : new Set()
              )
            }
          />
          Chọn tất cả ({bookings.length} đơn)
        </label>

        <Button size="sm" disabled={selectedIds.size === 0 || pending} onClick={bulkApprove}>
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Duyệt {selectedIds.size > 0 ? `${selectedIds.size} đơn đã chọn` : 'hàng loạt'}
        </Button>
      </div>

      {selectedHasIssues && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Có đơn đang thiếu thiết bị theo kiểm tra hiện tại; hệ thống sẽ báo lỗi riêng cho đơn đó
          khi duyệt.
        </p>
      )}

      <ul className="border-border divide-border divide-y rounded-xl border">
        {bookings.map((booking) => (
          <li key={booking.id} className="flex items-start gap-3 px-4 py-3">
            <input
              type="checkbox"
              className="accent-primary mt-1 h-4 w-4 shrink-0"
              checked={selectedIds.has(booking.id)}
              onChange={() => toggle(booking.id)}
              aria-label={`Chọn đơn thiết bị của ${booking.fullName}`}
            />

            <button
              type="button"
              onClick={() => setViewing(booking.id)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block text-sm font-medium">
                {booking.roomName} ·{' '}
                {vnRangeLabel(new Date(booking.startAt), new Date(booking.endAt))}
              </span>
              <span className="text-muted-foreground block text-xs">
                {booking.fullName}
                {booking.staffCode && ` · ${booking.staffCode}`}
                {booking.department && ` · ${booking.department}`}
              </span>
              <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                {booking.items.map((item) => `${item.equipmentName} x${item.quantity}`).join(' · ')}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-[11px]">
                Gửi lúc {vnDateTimeLabel(new Date(booking.createdAt))}
              </span>

              {booking.availabilityIssues.length > 0 && (
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                  Thiếu {booking.availabilityIssues.length} thiết bị
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {viewing && (
        <EquipmentBookingDetailDialog
          bookingId={viewing}
          onClose={() => setViewing(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}
