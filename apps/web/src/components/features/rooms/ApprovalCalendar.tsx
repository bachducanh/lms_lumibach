'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import {
  parseHHmm,
  vnAddDays,
  vnDateLabel,
  vnStartOfDay,
  vnStartOfWeek,
  DEFAULT_ROOM_BOOKING_SETTING,
  type RoomBookingListItem,
  type RoomDetail,
  type RoomListItem,
} from '@lumibach/types';
import { apiClient, ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AgendaList } from './AgendaList';
import { BookingDetailDialog } from './BookingDetailDialog';
import { StatusLegend } from './booking-status';
import { WeeklyReportButton } from './WeeklyReportButton';
import { WeekGrid } from './WeekGrid';

type ViewMode = 'week' | 'day';

/**
 * Lịch duyệt phòng của quản trị viên.
 *
 * Dùng đúng lưới lịch mà giáo viên nhìn khi đăng ký, thay vì danh sách phẳng:
 * quyết định duyệt hay không phụ thuộc vào việc khung giờ đó nằm ở đâu so với
 * các đơn khác trong tuần — nhìn lưới thấy ngay, đọc danh sách thì phải tự dựng
 * lại trong đầu.
 *
 * Bấm vào một khối là mở đúng hộp thoại chi tiết có sẵn nút Duyệt / Từ chối.
 */
export function ApprovalCalendar({ rooms }: { rooms: RoomListItem[] }) {
  const router = useRouter();
  const [roomId, setRoomId] = useState<string>(() => rooms[0]?.id ?? '');
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [moc, setMoc] = useState<Date>(() => new Date());

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [bookings, setBookings] = useState<RoomBookingListItem[]>([]);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState<string | null>(null);
  const [donDangXem, setDonDangXem] = useState<string | null>(null);

  const days = useMemo(() => layDanhSachNgay(moc, viewMode), [moc, viewMode]);
  const from = useMemo(() => vnStartOfDay(days[0] as Date), [days]);
  const to = useMemo(() => vnAddDays(vnStartOfDay(days[days.length - 1] as Date), 1), [days]);

  const phongDangChon = rooms.find((r) => r.id === roomId);

  const taiLai = useCallback(async () => {
    if (!roomId || !phongDangChon) return;
    setDangTai(true);
    setLoi(null);
    try {
      const [chiTiet, danhSach] = await Promise.all([
        apiClient.get<RoomDetail>(`/rooms/${encodeURIComponent(phongDangChon.code)}`),
        apiClient.get<RoomBookingListItem[]>(
          `/room-bookings?roomId=${roomId}&from=${from.toISOString()}&to=${to.toISOString()}`
        ),
      ]);
      setRoom(chiTiet);
      setBookings(danhSach);
    } catch (err) {
      setLoi(err instanceof ApiError ? err.message : 'Không tải được lịch phòng.');
    } finally {
      setDangTai(false);
    }
  }, [roomId, phongDangChon, from, to]);

  useEffect(() => {
    void taiLai();
  }, [taiLai]);

  const { openMinutes, closeMinutes, stepMinutes } = layKhungGio(room);
  const soDonChoDuyet = bookings.filter((b) => b.status === 'PENDING').length;

  const nhanKhoangNgay =
    viewMode === 'day'
      ? vnDateLabel(days[0] as Date)
      : `${vnDateLabel(days[0] as Date)} – ${vnDateLabel(days[days.length - 1] as Date)}`;

  if (rooms.length === 0) {
    return (
      <p className="text-muted-foreground border-border rounded-xl border border-dashed px-5 py-10 text-center text-sm">
        Chưa có phòng chức năng nào để hiển thị lịch.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMoc(vnAddDays(moc, viewMode === 'day' ? -1 : -7))}
            aria-label={viewMode === 'day' ? 'Ngày trước' : 'Tuần trước'}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMoc(new Date())}>
            Hôm nay
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMoc(vnAddDays(moc, viewMode === 'day' ? 1 : 7))}
            aria-label={viewMode === 'day' ? 'Ngày sau' : 'Tuần sau'}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground ml-2 text-sm font-medium">{nhanKhoangNgay}</span>
          {dangTai && <Loader2 className="text-muted-foreground ml-1 h-3.5 w-3.5 animate-spin" />}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={roomId}
            onValueChange={(v) => setRoomId((v as string) ?? '')}
            items={rooms.map((r) => ({ label: r.name, value: r.id }))}
          >
            <SelectTrigger size="sm" aria-label="Chọn phòng" className="min-w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  <span className="flex items-center gap-2">
                    {r.name}
                    {r.pendingBookingCount !== null && r.pendingBookingCount > 0 && (
                      <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        {r.pendingBookingCount}
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {phongDangChon && (
            <WeeklyReportButton roomId={roomId} roomName={phongDangChon.name} from={from} to={to} />
          )}

          <div className="border-border hidden overflow-hidden rounded-lg border md:flex">
            {(['week', 'day'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  viewMode === mode
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                )}
              >
                {mode === 'week' ? 'Tuần' : 'Ngày'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {soDonChoDuyet > 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
          {soDonChoDuyet} đơn trong tuần này đang chờ duyệt — bấm vào khối màu hổ phách để xử lý.
        </p>
      )}

      {loi && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
        >
          {loi}
          <Button variant="outline" size="sm" onClick={() => void taiLai()}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Thử lại
          </Button>
        </div>
      )}

      <div className="hidden md:block">
        <WeekGrid
          days={days}
          bookings={bookings}
          openMinutes={openMinutes}
          closeMinutes={closeMinutes}
          stepMinutes={stepMinutes}
          // Admin không đặt phòng từ màn hình duyệt — kéo chọn ở đây chỉ gây
          // nhầm; muốn đặt hộ thì vào trang phòng như giáo viên.
          onSelectSlot={() => undefined}
          onSelectBooking={(b) => setDonDangXem(b.id)}
        />
      </div>
      <div className="md:hidden">
        <AgendaList
          days={days}
          bookings={bookings}
          onSelectBooking={(b) => setDonDangXem(b.id)}
          onCreateForDay={() => undefined}
        />
      </div>

      <StatusLegend />

      {donDangXem && (
        <BookingDetailDialog
          bookingId={donDangXem}
          onClose={() => setDonDangXem(null)}
          onChanged={() => {
            void taiLai();
            router.refresh();
          }}
          onEdit={() => setDonDangXem(null)}
        />
      )}
    </div>
  );
}

function layDanhSachNgay(moc: Date, mode: ViewMode): Date[] {
  if (mode === 'day') return [vnStartOfDay(moc)];
  const thuHai = vnStartOfWeek(moc);
  return Array.from({ length: 6 }, (_, i) => vnAddDays(thuHai, i));
}

function layKhungGio(room: RoomDetail | null) {
  const setting = room?.setting ?? DEFAULT_ROOM_BOOKING_SETTING;
  const mo = parseHHmm(setting.openTime) ?? 7 * 60;
  const dong = parseHHmm(setting.closeTime) ?? 17 * 60 + 30;
  const hopLe = dong > mo;

  return {
    openMinutes: hopLe ? mo : 7 * 60,
    closeMinutes: hopLe ? dong : 17 * 60 + 30,
    stepMinutes: setting.slotStepMinutes > 0 ? setting.slotStepMinutes : 30,
  };
}
