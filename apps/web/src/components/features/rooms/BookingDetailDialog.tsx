'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Camera,
  Check,
  DoorOpen,
  KeyRound,
  Loader2,
  LogOut,
  Pencil,
  ScrollText,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  vnDateTimeLabel,
  vnRangeLabel,
  type BookingHandoverSummary,
  type HandoverPhotoDto,
  type RoomBookingDetail,
} from '@lumibach/types';
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

export function BookingDetailDialog({
  bookingId,
  onClose,
  onChanged,
  onEdit,
}: {
  bookingId: string;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (booking: RoomBookingDetail) => void;
}) {
  const router = useRouter();
  const [booking, setBooking] = useState<RoomBookingDetail | null>(null);
  const [summary, setSummary] = useState<BookingHandoverSummary | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [dangTuChoi, setDangTuChoi] = useState(false);
  const [lyDoTuChoi, setLyDoTuChoi] = useState('');
  const [loiTuChoi, setLoiTuChoi] = useState<string | null>(null);

  useEffect(() => {
    let huy = false;
    apiClient
      .get<RoomBookingDetail>(`/room-bookings/${bookingId}`)
      .then((data) => !huy && setBooking(data))
      .catch((err) =>
        setLoi(err instanceof ApiError ? err.message : 'Không tải được chi tiết đơn.')
      );

    apiClient
      .get<BookingHandoverSummary>(`/room-bookings/${bookingId}/handovers`)
      .then((handovers) => !huy && setSummary(handovers))
      .catch(() => !huy && setSummary(null));
    return () => {
      huy = true;
    };
  }, [bookingId]);

  function goiHanhDong(duongDan: string, body: unknown, thanhCong: string, thatBai: string) {
    startTransition(async () => {
      try {
        await apiClient.post<RoomBookingDetail>(`/room-bookings/${bookingId}${duongDan}`, body);
        toast.success(thanhCong);
        onChanged();
        onClose();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : thatBai);
      }
    });
  }

  const huyDon = () => goiHanhDong('/cancel', undefined, 'Đã huỷ đơn', 'Không huỷ được đơn.');
  const duyetDon = () =>
    goiHanhDong('/approve', undefined, 'Đã duyệt đơn', 'Không duyệt được đơn.');
  const xacNhanChiaKhoa = () =>
    goiHanhDong(
      '/confirm-key-return',
      undefined,
      'Đã xác nhận nhận lại chìa khoá',
      'Không xác nhận được.'
    );

  function tuChoiDon() {
    const lyDo = lyDoTuChoi.trim();
    if (lyDo.length < 5) {
      setLoiTuChoi('Vui lòng nêu rõ lý do từ chối (tối thiểu 5 ký tự).');
      return;
    }
    setLoiTuChoi(null);
    goiHanhDong('/reject', { reason: lyDo }, 'Đã từ chối đơn', 'Không từ chối được đơn.');
  }

  const coTheSua = booking?.availableActions.includes('reschedule') ?? false;
  const coTheHuy = booking?.availableActions.includes('cancel') ?? false;
  const coTheDuyet = booking?.availableActions.includes('approve') ?? false;
  const coTheTuChoi = booking?.availableActions.includes('reject') ?? false;
  const coTheHoanTat = booking?.availableActions.includes('complete') ?? false;
  const coTheNhanPhong = booking?.availableActions.includes('checkin') ?? false;
  const coTheTraPhong = booking?.availableActions.includes('checkout') ?? false;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chi tiết đơn mượn phòng</DialogTitle>
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
            Đang tải…
          </div>
        )}

        {booking && (
          <dl className="space-y-3 text-sm">
            <Dong nhan="Trạng thái">
              <StatusBadge status={booking.status} />
            </Dong>
            <Dong nhan="Người mượn">{booking.fullName}</Dong>
            {booking.staffCode && <Dong nhan="Mã nhân viên">{booking.staffCode}</Dong>}
            {booking.department && <Dong nhan="Tổ chuyên môn">{booking.department}</Dong>}
            <Dong nhan="Lý do">
              <span className="whitespace-pre-wrap">{booking.reason}</span>
            </Dong>
            <Dong nhan="Gửi lúc">{vnDateTimeLabel(new Date(booking.createdAt))}</Dong>

            {booking.approvedByName && (
              <Dong nhan="Người duyệt">
                {booking.approvedByName}
                {booking.approvedAt && ` · ${vnDateTimeLabel(new Date(booking.approvedAt))}`}
              </Dong>
            )}
            {booking.rejectReason && (
              <Dong nhan="Lý do từ chối">
                <span className="text-destructive">{booking.rejectReason}</span>
              </Dong>
            )}
            {booking.hasDiscrepancy && (
              <Dong nhan="Cảnh báo">
                <span className="text-destructive">
                  Số liệu bàn giao lúc trả lệch so với lúc nhận.
                </span>
              </Dong>
            )}
          </dl>
        )}

        {/* Nội quy hiện hành của phòng. Admin sửa thì đơn này cũng hiện theo
            bản mới — mỗi phòng chỉ giữ một bản. */}
        {booking?.ruleContent && (
          <details className="border-border rounded-lg border px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium">
              <ScrollText className="mr-1.5 inline h-4 w-4" />
              Nội quy phòng
            </summary>
            <div className="mt-2">
              <RichTextView html={booking.ruleContent} />
            </div>
          </details>
        )}

        {summary && (
          <HandoverPhotos
            checkinPhotos={summary.checkin?.photos ?? []}
            checkoutPhotos={summary.checkout?.photos ?? []}
          />
        )}

        {booking?.status === 'APPROVED' && (
          <p className="rounded-lg bg-sky-500/10 px-3 py-2 text-sm text-sky-800 dark:text-sky-200">
            Đơn đã được duyệt. Vui lòng gặp Quản trị viên để nhận chìa khoá.
          </p>
        )}

        {booking?.status === 'CHECKED_OUT' && (
          <p className="rounded-lg bg-teal-500/10 px-3 py-2 text-sm text-teal-800 dark:text-teal-200">
            Vui lòng mang trả chìa khoá cho Quản trị viên.
          </p>
        )}

        {dangTuChoi && (
          <div className="space-y-2">
            <label htmlFor="ly-do-tu-choi" className="text-sm font-medium">
              Lý do từ chối <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="ly-do-tu-choi"
              rows={3}
              value={lyDoTuChoi}
              onChange={(e) => setLyDoTuChoi(e.target.value)}
              placeholder="VD: Phòng đang bảo trì máy trong tuần này"
            />
            {loiTuChoi && <p className="text-destructive text-sm">{loiTuChoi}</p>}
          </div>
        )}

        <DialogFooter>
          {dangTuChoi ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setDangTuChoi(false);
                  setLoiTuChoi(null);
                }}
                disabled={pending}
              >
                Quay lại
              </Button>
              <Button variant="destructive" onClick={tuChoiDon} disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Xác nhận từ chối
              </Button>
            </>
          ) : (
            <>
              {coTheHuy && (
                <Button variant="outline" onClick={huyDon} disabled={pending}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Huỷ đơn
                </Button>
              )}
              {coTheSua && booking && (
                <Button variant="outline" onClick={() => onEdit(booking)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Sửa đơn
                </Button>
              )}
              {/* Bàn giao là một màn hình riêng, không nhét vừa hộp thoại:
                  có nội quy, form trường động và phần chụp ảnh. */}
              {coTheNhanPhong && (
                <Button onClick={() => router.push(`/rooms/bookings/${bookingId}/checkin`)}>
                  <DoorOpen className="mr-2 h-4 w-4" />
                  Nhận phòng
                </Button>
              )}
              {coTheTraPhong && (
                <Button onClick={() => router.push(`/rooms/bookings/${bookingId}/checkout`)}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Trả phòng
                </Button>
              )}
              {coTheTuChoi && (
                <Button
                  variant="destructive"
                  onClick={() => setDangTuChoi(true)}
                  disabled={pending}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Từ chối
                </Button>
              )}
              {coTheDuyet && (
                <Button onClick={duyetDon} disabled={pending}>
                  {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Check className="mr-2 h-4 w-4" />
                  Duyệt đơn
                </Button>
              )}
              {coTheHoanTat && (
                <Button onClick={xacNhanChiaKhoa} disabled={pending}>
                  {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <KeyRound className="mr-2 h-4 w-4" />
                  Đã nhận lại chìa khoá
                </Button>
              )}
              {!coTheHuy &&
                !coTheSua &&
                !coTheDuyet &&
                !coTheTuChoi &&
                !coTheHoanTat &&
                !coTheNhanPhong &&
                !coTheTraPhong && (
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

function HandoverPhotos({
  checkinPhotos,
  checkoutPhotos,
}: {
  checkinPhotos: HandoverPhotoDto[];
  checkoutPhotos: HandoverPhotoDto[];
}) {
  if (checkinPhotos.length + checkoutPhotos.length === 0) return null;

  return (
    <details className="border-border rounded-lg border px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium">
        <Camera className="mr-1.5 inline h-4 w-4" />
        Ảnh bàn giao
      </summary>
      <div className="mt-3 space-y-3">
        <PhotoGroup label="Nhận phòng" photos={checkinPhotos} />
        <PhotoGroup label="Trả phòng" photos={checkoutPhotos} />
      </div>
    </details>
  );
}

function PhotoGroup({ label, photos }: { label: string; photos: HandoverPhotoDto[] }) {
  if (photos.length === 0) return null;
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs font-medium">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="block">
            <img
              src={photo.url}
              alt=""
              className="aspect-square w-full rounded-md border object-cover"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

function Dong({ nhan, children }: { nhan: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] items-start gap-3">
      <dt className="text-muted-foreground">{nhan}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
