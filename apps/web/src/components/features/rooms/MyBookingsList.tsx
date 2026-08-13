'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarX, DoorOpen } from 'lucide-react';
import { vnRangeLabel, type RoomBookingListItem } from '@lumibach/types';
import { STATUS_VISUAL } from './booking-status';
import { BookingDetailDialog } from './BookingDetailDialog';

/**
 * Đơn của tôi, tách làm hai nhóm: đang còn hiệu lực (sắp tới / đang dùng) và
 * đã kết thúc. Giáo viên vào đây chủ yếu để tìm đơn sắp diễn ra, nên nhóm đó
 * đặt trên và sắp xếp theo thời gian tăng dần.
 */
export function MyBookingsList({ bookings }: { bookings: RoomBookingListItem[] }) {
  const router = useRouter();
  const [donDangXem, setDonDangXem] = useState<string | null>(null);

  const { conHieuLuc, daXong } = useMemo(() => {
    const dangHoatDong = new Set(['PENDING', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT']);
    return {
      conHieuLuc: bookings
        .filter((b) => dangHoatDong.has(b.status))
        .sort((a, b) => a.startAt.localeCompare(b.startAt)),
      daXong: bookings
        .filter((b) => !dangHoatDong.has(b.status))
        .sort((a, b) => b.startAt.localeCompare(a.startAt)),
    };
  }, [bookings]);

  if (bookings.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center">
        <CalendarX className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p className="font-medium">Bạn chưa có đơn mượn phòng nào</p>
        <p className="mt-1 text-sm">Vào một phòng chức năng và chọn khung giờ để đăng ký.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {conHieuLuc.length > 0 && (
        <Nhom tieuDe="Đang xử lý và sắp tới" bookings={conHieuLuc} onSelect={setDonDangXem} />
      )}
      {daXong.length > 0 && (
        <Nhom tieuDe="Đã kết thúc" bookings={daXong} onSelect={setDonDangXem} mo />
      )}

      {donDangXem && (
        <BookingDetailDialog
          bookingId={donDangXem}
          onClose={() => setDonDangXem(null)}
          onChanged={() => router.refresh()}
          onEdit={(chiTiet) => {
            // Sửa đơn diễn ra trên lịch của phòng, nơi thấy được khung giờ trống.
            router.push(`/rooms/${chiTiet.roomCode}`);
          }}
        />
      )}
    </div>
  );
}

function Nhom({
  tieuDe,
  bookings,
  onSelect,
  mo = false,
}: {
  tieuDe: string;
  bookings: RoomBookingListItem[];
  onSelect: (id: string) => void;
  mo?: boolean;
}) {
  return (
    <section>
      <h2 className="text-muted-foreground mb-2 text-xs font-bold tracking-[0.15em] uppercase">
        {tieuDe}
      </h2>
      <ul
        className={`border-border divide-border divide-y rounded-xl border ${mo ? 'opacity-70' : ''}`}
      >
        {bookings.map((booking) => {
          const { Icon, label, block } = STATUS_VISUAL[booking.status];
          return (
            <li key={booking.id}>
              <button
                type="button"
                onClick={() => onSelect(booking.id)}
                className="hover:bg-muted/40 flex w-full items-start gap-3 px-4 py-3 text-left transition-colors"
              >
                <DoorOpen className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{booking.roomName}</span>
                  <span className="text-muted-foreground block text-xs tabular-nums">
                    {vnRangeLabel(new Date(booking.startAt), new Date(booking.endAt))}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                    {booking.reason}
                  </span>
                </span>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${block}`}
                >
                  <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
