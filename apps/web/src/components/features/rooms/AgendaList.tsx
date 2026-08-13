'use client';

import { CalendarPlus, Plus } from 'lucide-react';
import {
  vnDateKey,
  vnDateLabel,
  vnTimeLabel,
  vnWeekdayLabel,
  type RoomBookingListItem,
} from '@lumibach/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { STATUS_VISUAL } from './booking-status';

type Props = {
  days: Date[];
  bookings: RoomBookingListItem[];
  onSelectBooking: (booking: RoomBookingListItem) => void;
  onCreateForDay: (day: Date) => void;
};

/**
 * Danh sách theo ngày, thay cho lưới lịch trên màn hình hẹp.
 *
 * Lưới giờ trên điện thoại vừa khó bấm vừa phải cuộn ngang; giáo viên chủ yếu
 * dùng điện thoại để xem lịch hôm nay và nhận phòng, nên dạng danh sách hợp hơn.
 */
export function AgendaList({ days, bookings, onSelectBooking, onCreateForDay }: Props) {
  const homNay = vnDateKey(new Date());

  return (
    <div className="space-y-3">
      {days.map((day) => {
        const dateKey = vnDateKey(day);
        const donTrongNgay = bookings
          .filter((b) => vnDateKey(new Date(b.startAt)) === dateKey)
          .sort((a, b) => a.startAt.localeCompare(b.startAt));
        const laHomNay = dateKey === homNay;

        return (
          <section
            key={dateKey}
            className={cn(
              'border-border overflow-hidden rounded-xl border',
              laHomNay && 'border-primary/40'
            )}
          >
            <header
              className={cn(
                'bg-muted/40 flex items-center justify-between gap-2 px-3 py-2',
                laHomNay && 'bg-primary/10'
              )}
            >
              <h3 className="text-sm font-semibold">
                {vnWeekdayLabel(day)}, {vnDateLabel(day)}
                {laHomNay && <span className="text-primary ml-2 text-xs">Hôm nay</span>}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCreateForDay(day)}
                aria-label={`Đăng ký mượn phòng ngày ${vnDateLabel(day)}`}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </header>

            {donTrongNgay.length === 0 ? (
              <button
                type="button"
                onClick={() => onCreateForDay(day)}
                className="text-muted-foreground hover:bg-muted/40 flex w-full items-center justify-center gap-2 px-3 py-5 text-sm transition-colors"
              >
                <CalendarPlus className="h-4 w-4" />
                Còn trống cả ngày — bấm để đăng ký
              </button>
            ) : (
              <ul className="divide-border divide-y">
                {donTrongNgay.map((booking) => {
                  const { Icon, label, block } = STATUS_VISUAL[booking.status];
                  return (
                    <li key={booking.id}>
                      <button
                        type="button"
                        onClick={() => onSelectBooking(booking)}
                        className="hover:bg-muted/40 flex w-full items-start gap-3 px-3 py-3 text-left transition-colors"
                      >
                        <span className="text-muted-foreground w-24 shrink-0 text-sm tabular-nums">
                          {vnTimeLabel(new Date(booking.startAt))}
                          <br />
                          {vnTimeLabel(new Date(booking.endAt))}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium">{booking.fullName}</span>
                            {booking.isMine && (
                              <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-[10px] font-semibold">
                                Đơn của tôi
                              </span>
                            )}
                          </span>
                          {booking.department && (
                            <span className="text-muted-foreground block truncate text-xs">
                              {booking.department}
                            </span>
                          )}
                          <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                            {booking.reason}
                          </span>
                          <span
                            className={cn(
                              'mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                              block
                            )}
                          >
                            <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {label}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
