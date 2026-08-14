'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Check, Loader2, PackageCheck, PackageOpen, RotateCcw, XCircle } from 'lucide-react';
import { vnDateTimeLabel, vnRangeLabel, type EquipmentBookingDetail } from '@lumibach/types';
import { apiClient, ApiError } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RichTextView } from '@/components/ui/editor/RichTextView';
import { StatusBadge } from './booking-status';

export function EquipmentBookingDetailDialog({
  bookingId,
  onClose,
  onChanged,
}: {
  bookingId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [booking, setBooking] = useState<EquipmentBookingDetail | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [dangTuChoi, setDangTuChoi] = useState(false);
  const [lyDoTuChoi, setLyDoTuChoi] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<EquipmentBookingDetail>(`/equipment-bookings/${bookingId}`)
      .then((data) => !cancelled && setBooking(data))
      .catch((err) =>
        setLoi(err instanceof ApiError ? err.message : 'Không tải được chi tiết đơn thiết bị.')
      );
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  function callAction(path: string, body: unknown, success: string, failure: string) {
    startTransition(async () => {
      try {
        await apiClient.post<EquipmentBookingDetail>(
          `/equipment-bookings/${bookingId}${path}`,
          body
        );
        toast.success(success);
        onChanged();
        onClose();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : failure);
      }
    });
  }

  function reject() {
    const reason = lyDoTuChoi.trim();
    if (reason.length < 5) {
      toast.error('Vui lòng nêu rõ lý do từ chối.');
      return;
    }
    callAction('/reject', { reason }, 'Đã từ chối đơn', 'Không từ chối được đơn.');
  }

  const actions = new Set(booking?.availableActions ?? []);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chi tiết đơn mượn thiết bị</DialogTitle>
          {booking && (
            <DialogDescription>
              {booking.roomName} ·{' '}
              {vnRangeLabel(new Date(booking.startAt), new Date(booking.endAt))}
            </DialogDescription>
          )}
        </DialogHeader>

        {loi && <p className="text-destructive text-sm">{loi}</p>}
        {!booking && !loi && (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải...
          </div>
        )}

        {booking && (
          <div className="space-y-4">
            <dl className="space-y-3 text-sm">
              <Row label="Trạng thái">
                <StatusBadge status={booking.status} />
              </Row>
              <Row label="Người mượn">{booking.fullName}</Row>
              {booking.staffCode && <Row label="Mã nhân viên">{booking.staffCode}</Row>}
              {booking.department && <Row label="Tổ chuyên môn">{booking.department}</Row>}
              <Row label="Lý do">
                <span className="whitespace-pre-wrap">{booking.reason}</span>
              </Row>
              <Row label="Gửi lúc">{vnDateTimeLabel(new Date(booking.createdAt))}</Row>
              {booking.approvedByName && (
                <Row label="Người duyệt">
                  {booking.approvedByName}
                  {booking.approvedAt && ` · ${vnDateTimeLabel(new Date(booking.approvedAt))}`}
                </Row>
              )}
              {booking.returnedAt && (
                <Row label="Nhận lại">{vnDateTimeLabel(new Date(booking.returnedAt))}</Row>
              )}
              {booking.rejectReason && (
                <Row label="Lý do từ chối">
                  <span className="text-destructive">{booking.rejectReason}</span>
                </Row>
              )}
            </dl>

            <div>
              <p className="mb-2 text-sm font-medium">Thiết bị</p>
              <ul className="border-border divide-border divide-y rounded-lg border text-sm">
                {booking.items.map((item) => (
                  <li key={item.equipmentId} className="flex justify-between gap-3 px-3 py-2">
                    <span className="min-w-0">
                      {item.equipmentName}
                      {item.equipmentCode && (
                        <span className="text-muted-foreground"> · {item.equipmentCode}</span>
                      )}
                    </span>
                    <span className="text-muted-foreground shrink-0">
                      {item.quantity} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {booking.ruleContent && (
              <details className="border-border rounded-lg border px-3 py-2 text-sm">
                <summary className="cursor-pointer font-medium">Nội quy phòng</summary>
                <div className="mt-2">
                  <RichTextView html={booking.ruleContent} />
                </div>
              </details>
            )}

            {dangTuChoi && (
              <div className="space-y-2">
                <label htmlFor="equipment-reject-reason" className="text-sm font-medium">
                  Lý do từ chối
                </label>
                <Textarea
                  id="equipment-reject-reason"
                  rows={3}
                  value={lyDoTuChoi}
                  onChange={(e) => setLyDoTuChoi(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {dangTuChoi ? (
            <>
              <Button variant="outline" onClick={() => setDangTuChoi(false)} disabled={pending}>
                Quay lại
              </Button>
              <Button variant="destructive" onClick={reject} disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Xác nhận từ chối
              </Button>
            </>
          ) : (
            <>
              {actions.has('cancel') && (
                <Button
                  variant="outline"
                  onClick={() =>
                    callAction('/cancel', undefined, 'Đã hủy đơn', 'Không hủy được đơn.')
                  }
                  disabled={pending}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Hủy đơn
                </Button>
              )}
              {actions.has('checkin') && (
                <Button
                  onClick={() =>
                    callAction(
                      '/checkin',
                      undefined,
                      'Đã xác nhận nhận thiết bị',
                      'Không xác nhận được.'
                    )
                  }
                  disabled={pending}
                >
                  <PackageOpen className="mr-2 h-4 w-4" />
                  Đã nhận
                </Button>
              )}
              {actions.has('checkout') && (
                <Button
                  onClick={() =>
                    callAction(
                      '/checkout',
                      undefined,
                      'Đã xác nhận trả thiết bị',
                      'Không xác nhận được.'
                    )
                  }
                  disabled={pending}
                >
                  <PackageCheck className="mr-2 h-4 w-4" />
                  Đã trả
                </Button>
              )}
              {actions.has('reject') && (
                <Button
                  variant="destructive"
                  onClick={() => setDangTuChoi(true)}
                  disabled={pending}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Từ chối
                </Button>
              )}
              {actions.has('approve') && (
                <Button
                  onClick={() =>
                    callAction('/approve', undefined, 'Đã duyệt đơn', 'Không duyệt được đơn.')
                  }
                  disabled={pending}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Duyệt
                </Button>
              )}
              {actions.has('complete') && (
                <Button
                  onClick={() =>
                    callAction(
                      '/confirm-return',
                      undefined,
                      'Đã xác nhận nhận lại thiết bị',
                      'Không xác nhận được.'
                    )
                  }
                  disabled={pending}
                >
                  <PackageCheck className="mr-2 h-4 w-4" />
                  Đã nhận lại
                </Button>
              )}
              {actions.size === 0 && (
                <Button variant="outline" onClick={onClose}>
                  Đóng
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-start gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
