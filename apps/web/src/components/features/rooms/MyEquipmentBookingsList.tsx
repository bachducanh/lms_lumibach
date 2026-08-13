'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarX, Package } from 'lucide-react';
import { vnRangeLabel, type EquipmentBookingListItem } from '@lumibach/types';
import { STATUS_VISUAL } from './booking-status';
import { EquipmentBookingDetailDialog } from './EquipmentBookingDetailDialog';

export function MyEquipmentBookingsList({ bookings }: { bookings: EquipmentBookingListItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const { active, done } = useMemo(() => {
    const activeStatuses = new Set(['PENDING', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT']);
    return {
      active: bookings
        .filter((booking) => activeStatuses.has(booking.status))
        .sort((a, b) => a.startAt.localeCompare(b.startAt)),
      done: bookings
        .filter((booking) => !activeStatuses.has(booking.status))
        .sort((a, b) => b.startAt.localeCompare(a.startAt)),
    };
  }, [bookings]);

  if (bookings.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-xl border border-dashed px-6 py-10 text-center">
        <CalendarX className="mx-auto mb-3 h-9 w-9 opacity-40" />
        <p className="font-medium">Bạn chưa có đơn mượn thiết bị nào</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <Group title="Đang xử lý và sắp tới" bookings={active} onSelect={setSelected} />
      )}
      {done.length > 0 && (
        <Group title="Đã kết thúc" bookings={done} onSelect={setSelected} muted />
      )}

      {selected && (
        <EquipmentBookingDetailDialog
          bookingId={selected}
          onClose={() => setSelected(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}

function Group({
  title,
  bookings,
  onSelect,
  muted = false,
}: {
  title: string;
  bookings: EquipmentBookingListItem[];
  onSelect: (id: string) => void;
  muted?: boolean;
}) {
  return (
    <section>
      <h2 className="text-muted-foreground mb-2 text-xs font-bold tracking-[0.15em] uppercase">
        {title}
      </h2>
      <ul
        className={`border-border divide-border divide-y rounded-xl border ${muted ? 'opacity-70' : ''}`}
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
                <Package className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{booking.roomName}</span>
                  <span className="text-muted-foreground block text-xs tabular-nums">
                    {vnRangeLabel(new Date(booking.startAt), new Date(booking.endAt))}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                    {booking.items
                      .map((item) => `${item.equipmentName} x${item.quantity}`)
                      .join(' · ')}
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
