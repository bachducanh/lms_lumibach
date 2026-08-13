'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, Check, ClipboardCheck, Loader2 } from 'lucide-react';
import {
  vnDateTimeLabel,
  vnRangeLabel,
  type BulkApproveResult,
  type PendingBookingItem,
} from '@lumibach/types';
import { apiClient, ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BookingDetailDialog } from './BookingDetailDialog';

export function PendingBookingsQueue({ bookings }: { bookings: PendingBookingItem[] }) {
  const router = useRouter();
  const [dangChon, setDangChon] = useState<Set<string>>(new Set());
  const [donDangXem, setDonDangXem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function doiChon(id: string) {
    setDangChon((truoc) => {
      const sau = new Set(truoc);
      if (sau.has(id)) sau.delete(id);
      else sau.add(id);
      return sau;
    });
  }

  const tatCaDaChon = bookings.length > 0 && dangChon.size === bookings.length;
  const coXungDotTrongLuaChon = bookings.some(
    (b) => dangChon.has(b.id) && b.conflictsWith.length > 0
  );

  function duyetHangLoat() {
    startTransition(async () => {
      try {
        const kq = await apiClient.post<BulkApproveResult>('/room-bookings/bulk-approve', {
          ids: [...dangChon],
        });

        if (kq.failed.length === 0) {
          toast.success(`Đã duyệt ${kq.approved.length} đơn`);
        } else {
          // Nêu rõ đơn nào trượt vì lý do gì — duyệt hàng loạt mà chỉ báo
          // "có lỗi" thì admin không biết phải xử lý tiếp cái nào.
          toast.warning(
            `Duyệt được ${kq.approved.length} đơn, ${kq.failed.length} đơn không duyệt được: ` +
              kq.failed.map((f) => f.reason).join(' · ')
          );
        }

        setDangChon(new Set());
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Không duyệt được, thử lại sau.');
      }
    });
  }

  if (bookings.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center">
        <ClipboardCheck className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p className="font-medium">Không có đơn nào chờ duyệt</p>
        <p className="mt-1 text-sm">Mọi đơn đăng ký đã được xử lý.</p>
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
            checked={tatCaDaChon}
            onChange={(e) =>
              setDangChon(e.target.checked ? new Set(bookings.map((b) => b.id)) : new Set())
            }
          />
          Chọn tất cả ({bookings.length} đơn)
        </label>

        <Button size="sm" disabled={dangChon.size === 0 || pending} onClick={duyetHangLoat}>
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Duyệt {dangChon.size > 0 ? `${dangChon.size} đơn đã chọn` : 'hàng loạt'}
        </Button>
      </div>

      {coXungDotTrongLuaChon && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Trong số đơn đã chọn có đơn trùng giờ với đơn khác. Duyệt được đơn nào thì hệ thống chỉ
          duyệt đơn đó, các đơn trùng còn lại sẽ bị từ chối và báo lại cho bạn.
        </p>
      )}

      <ul className="border-border divide-border divide-y rounded-xl border">
        {bookings.map((booking) => (
          <li key={booking.id} className="flex items-start gap-3 px-4 py-3">
            <input
              type="checkbox"
              className="accent-primary mt-1 h-4 w-4 shrink-0"
              checked={dangChon.has(booking.id)}
              onChange={() => doiChon(booking.id)}
              aria-label={`Chọn đơn của ${booking.fullName}`}
            />

            <button
              type="button"
              onClick={() => setDonDangXem(booking.id)}
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
                {booking.reason}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-[11px]">
                Gửi lúc {vnDateTimeLabel(new Date(booking.createdAt))}
              </span>

              {booking.conflictsWith.length > 0 && (
                <span
                  className={cn(
                    'mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                    'border-amber-400/60 bg-amber-500/15 text-amber-900 dark:text-amber-200'
                  )}
                >
                  <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                  Trùng giờ với {booking.conflictsWith.length} đơn khác
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {donDangXem && (
        <BookingDetailDialog
          bookingId={donDangXem}
          onClose={() => setDonDangXem(null)}
          onChanged={() => router.refresh()}
          onEdit={() => setDonDangXem(null)}
        />
      )}
    </div>
  );
}
