'use client';

import { useEffect, useRef, useState } from 'react';
import {
  formatHHmm,
  vnDateKey,
  vnDateLabel,
  vnDateTimeToUtc,
  vnMinutesOfDay,
  vnParts,
  vnTimeLabel,
  vnWeekdayLabel,
  type RoomBookingListItem,
} from '@lumibach/types';
import { cn } from '@/lib/utils';
import { STATUS_VISUAL } from './booking-status';

export type SlotSelection = { startAt: Date; endAt: Date };

type Props = {
  /** Các ngày được vẽ thành cột, theo đúng thứ tự hiển thị. */
  days: Date[];
  bookings: RoomBookingListItem[];
  openMinutes: number;
  closeMinutes: number;
  stepMinutes: number;
  onSelectSlot: (selection: SlotSelection) => void;
  onSelectBooking: (booking: RoomBookingListItem) => void;
};

/** Chiều cao một bước slot, tính bằng px. Quyết định độ cao toàn lưới. */
const SLOT_HEIGHT = 28;

/**
 * Lưới lịch tuần dựng bằng CSS Grid.
 *
 * Bố cục: một cột nhãn giờ cố định + N cột ngày. Mỗi cột ngày là một khối
 * `relative`; các đơn được đặt tuyệt đối bên trong theo tỉ lệ phút, nhờ vậy
 * đơn lệch mốc slot (do admin đặt hộ) vẫn vẽ đúng vị trí.
 *
 * Chỉ dùng cho màn hình từ 768px trở lên — điện thoại chuyển sang AgendaList.
 */
export function WeekGrid({
  days,
  bookings,
  openMinutes,
  closeMinutes,
  stepMinutes,
  onSelectSlot,
  onSelectBooking,
}: Props) {
  const tongPhut = closeMinutes - openMinutes;
  const soBuoc = Math.max(1, Math.ceil(tongPhut / stepMinutes));
  const chieuCao = soBuoc * SLOT_HEIGHT;

  const [dangKeo, setDangKeo] = useState<{
    dateKey: string;
    tuPhut: number;
    denPhut: number;
  } | null>(null);
  const keoRef = useRef<{ dateKey: string; mocPhut: number } | null>(null);

  // Kết thúc thao tác kéo dù con trỏ đã rời khỏi lưới — nếu chỉ nghe pointerup
  // trên chính cột thì kéo ra ngoài rồi thả sẽ để lại vùng chọn treo lơ lửng.
  useEffect(() => {
    if (!dangKeo) return;

    function ketThuc() {
      const chon = dangKeo;
      keoRef.current = null;
      setDangKeo(null);
      if (!chon) return;

      const tu = Math.min(chon.tuPhut, chon.denPhut);
      const den = Math.max(chon.tuPhut, chon.denPhut) + stepMinutes;
      onSelectSlot({
        startAt: vnDateTimeToUtc(chon.dateKey, tu),
        endAt: vnDateTimeToUtc(chon.dateKey, den),
      });
    }

    window.addEventListener('pointerup', ketThuc);
    return () => window.removeEventListener('pointerup', ketThuc);
  }, [dangKeo, stepMinutes, onSelectSlot]);

  function phutTuToaDo(e: React.PointerEvent<HTMLDivElement>): number {
    const rect = e.currentTarget.getBoundingClientRect();
    const tiLe = (e.clientY - rect.top) / rect.height;
    const phut = openMinutes + tiLe * tongPhut;
    const lamTron = Math.floor(phut / stepMinutes) * stepMinutes;
    return Math.min(Math.max(lamTron, openMinutes), closeMinutes - stepMinutes);
  }

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      {/* Hàng tiêu đề: nhãn thứ + ngày */}
      <div
        className="border-border bg-muted/40 grid border-b"
        style={{ gridTemplateColumns: `4rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div className="border-border border-r" />
        {days.map((day) => {
          const homNay = vnDateKey(day) === vnDateKey(new Date());
          const { day: ngay, month } = vnParts(day);
          return (
            <div
              key={vnDateKey(day)}
              className={cn(
                'border-border border-r px-2 py-2 text-center last:border-r-0',
                homNay && 'bg-primary/10'
              )}
            >
              <div className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                {vnWeekdayLabel(day)}
              </div>
              <div className={cn('text-sm font-semibold', homNay && 'text-primary')}>
                {ngay}/{month}
              </div>
            </div>
          );
        })}
      </div>

      {/* Thân lịch */}
      <div
        className="grid"
        style={{ gridTemplateColumns: `4rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <TruccGio
          openMinutes={openMinutes}
          soBuoc={soBuoc}
          stepMinutes={stepMinutes}
          chieuCao={chieuCao}
        />

        {days.map((day) => {
          const dateKey = vnDateKey(day);
          const donTrongNgay = bookings.filter((b) => vnDateKey(new Date(b.startAt)) === dateKey);

          return (
            <div
              key={dateKey}
              className="border-border relative border-r last:border-r-0"
              style={{ height: chieuCao }}
              onPointerDown={(e) => {
                // Bỏ qua khi bấm trúng một khối đơn — khối tự xử lý click.
                if ((e.target as HTMLElement).closest('[data-booking-block]')) return;
                const phut = phutTuToaDo(e);
                keoRef.current = { dateKey, mocPhut: phut };
                setDangKeo({ dateKey, tuPhut: phut, denPhut: phut });
              }}
              onPointerMove={(e) => {
                if (!keoRef.current || keoRef.current.dateKey !== dateKey) return;
                setDangKeo({
                  dateKey,
                  tuPhut: keoRef.current.mocPhut,
                  denPhut: phutTuToaDo(e),
                });
              }}
            >
              {/* Đường kẻ ngang mỗi bước slot */}
              {Array.from({ length: soBuoc }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'border-border/60 absolute inset-x-0 border-t',
                    // Vạch đậm hơn ở mỗi đầu giờ tròn.
                    (openMinutes + i * stepMinutes) % 60 === 0 ? 'border-border' : 'border-dashed'
                  )}
                  style={{ top: i * SLOT_HEIGHT }}
                />
              ))}

              {/* Vùng đang kéo chọn */}
              {dangKeo?.dateKey === dateKey && (
                <VungChon
                  tuPhut={Math.min(dangKeo.tuPhut, dangKeo.denPhut)}
                  denPhut={Math.max(dangKeo.tuPhut, dangKeo.denPhut) + stepMinutes}
                  openMinutes={openMinutes}
                  tongPhut={tongPhut}
                />
              )}

              <DuongKeHienTai day={day} openMinutes={openMinutes} tongPhut={tongPhut} />

              {donTrongNgay.map((booking) => (
                <KhoiDon
                  key={booking.id}
                  booking={booking}
                  openMinutes={openMinutes}
                  tongPhut={tongPhut}
                  onClick={() => onSelectBooking(booking)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TruccGio({
  openMinutes,
  soBuoc,
  stepMinutes,
  chieuCao,
}: {
  openMinutes: number;
  soBuoc: number;
  stepMinutes: number;
  chieuCao: number;
}) {
  return (
    <div className="border-border relative border-r" style={{ height: chieuCao }}>
      {Array.from({ length: soBuoc }).map((_, i) => {
        const phut = openMinutes + i * stepMinutes;
        const dauGio = phut % 60 === 0;
        return (
          <div
            key={i}
            className={cn(
              'text-muted-foreground absolute right-2 -translate-y-1/2 text-[11px] tabular-nums',
              !dauGio && 'opacity-0 md:opacity-50'
            )}
            style={{ top: i * SLOT_HEIGHT }}
          >
            {formatHHmm(phut)}
          </div>
        );
      })}
    </div>
  );
}

function VungChon({
  tuPhut,
  denPhut,
  openMinutes,
  tongPhut,
}: {
  tuPhut: number;
  denPhut: number;
  openMinutes: number;
  tongPhut: number;
}) {
  const top = ((tuPhut - openMinutes) / tongPhut) * 100;
  const height = ((denPhut - tuPhut) / tongPhut) * 100;

  return (
    <div
      className="border-primary bg-primary/20 pointer-events-none absolute inset-x-1 z-20 rounded-md border-2 border-dashed"
      style={{ top: `${top}%`, height: `${height}%` }}
    >
      <span className="text-primary absolute inset-x-0 top-0.5 text-center text-[10px] font-semibold">
        {formatHHmm(tuPhut)}–{formatHHmm(denPhut)}
      </span>
    </div>
  );
}

/** Đường kẻ đỏ chỉ thời điểm hiện tại, chỉ vẽ trên cột của ngày hôm nay. */
function DuongKeHienTai({
  day,
  openMinutes,
  tongPhut,
}: {
  day: Date;
  openMinutes: number;
  tongPhut: number;
}) {
  const [bayGio, setBayGio] = useState<Date | null>(null);

  // Đặt trong effect để tránh lệch giữa HTML dựng ở server và ở trình duyệt.
  useEffect(() => {
    setBayGio(new Date());
    const id = setInterval(() => setBayGio(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!bayGio || vnDateKey(bayGio) !== vnDateKey(day)) return null;

  const phut = vnMinutesOfDay(bayGio);
  if (phut < openMinutes || phut > openMinutes + tongPhut) return null;

  const top = ((phut - openMinutes) / tongPhut) * 100;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex items-center"
      style={{ top: `${top}%` }}
      aria-hidden="true"
    >
      <span className="bg-primary -ml-1 h-2 w-2 rounded-full" />
      <span className="bg-primary h-px flex-1" />
    </div>
  );
}

function KhoiDon({
  booking,
  openMinutes,
  tongPhut,
  onClick,
}: {
  booking: RoomBookingListItem;
  openMinutes: number;
  tongPhut: number;
  onClick: () => void;
}) {
  const start = new Date(booking.startAt);
  const end = new Date(booking.endAt);
  const tuPhut = vnMinutesOfDay(start);
  const denPhut = vnMinutesOfDay(end);

  const top = ((tuPhut - openMinutes) / tongPhut) * 100;
  const height = ((denPhut - tuPhut) / tongPhut) * 100;
  const { Icon, label, block, bar } = STATUS_VISUAL[booking.status];

  const khungGio = `${vnTimeLabel(start)}–${vnTimeLabel(end)}`;
  const soPhut = denPhut - tuPhut;
  // Chỗ hiển thị co theo chiều cao khối: khối 30 phút chỉ đủ một dòng.
  const rongRai = soPhut >= 90;
  const vuaDu = soPhut >= 60;

  return (
    <button
      type="button"
      data-booking-block
      onClick={onClick}
      title={`${khungGio} ${vnDateLabel(start)} · ${label} · ${booking.fullName}${booking.department ? ` · ${booking.department}` : ''}`}
      className={cn(
        'absolute inset-x-1 z-10 overflow-hidden rounded-md border py-1 pr-1.5 pl-2.5 text-left text-[11px] leading-tight',
        'transition-[box-shadow,background-color] hover:z-20 hover:shadow-md',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        booking.isMine && 'ring-primary/50 ring-1',
        block
      )}
      style={{ top: `${top}%`, height: `${height}%`, minHeight: 18 }}
    >
      {/* Vạch màu đặc: khối 30 phút không đủ chỗ cho chữ, vạch này vẫn cho biết
          trạng thái ngay từ cái nhìn đầu tiên. */}
      <span className={cn('absolute inset-y-0 left-0 w-1', bar)} aria-hidden="true" />

      {/* Khung giờ đứng đầu: đây là thông tin người xem lịch cần trước nhất. */}
      <span className="block truncate font-semibold tabular-nums">{khungGio}</span>

      <span className="flex items-center gap-1">
        <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate font-medium">{booking.fullName}</span>
      </span>

      {rongRai && booking.department && (
        <span className="block truncate opacity-80">{booking.department}</span>
      )}
      {vuaDu && <span className="block truncate opacity-70">{label}</span>}
    </button>
  );
}
