'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw } from 'lucide-react';
import {
  parseHHmm,
  vnAddDays,
  vnDateLabel,
  vnDateTimeToUtc,
  vnDateKey,
  vnStartOfDay,
  vnStartOfWeek,
  ROOM_BOOKING_STATUS_LABEL,
  displayStepMinutes,
  type RoomBookingListItem,
  type RoomBookingSettingDto,
  type RoomBookingStatusValue,
  type RoomDetail,
  type StaffProfileDto,
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
import { StatusLegend, STATUS_VISUAL } from './booking-status';
import { AgendaList } from './AgendaList';
import { BookingDetailDialog } from './BookingDetailDialog';
import { BookingFormDialog, type BookingFormInitial } from './BookingFormDialog';
import { WeekGrid, type SlotSelection } from './WeekGrid';

type ViewMode = 'week' | 'day';

type Props = {
  room: RoomDetail;
  staffProfile: StaffProfileDto | null;
  /** Họ tên lấy từ hồ sơ người dùng, dùng điền sẵn form đăng ký. */
  defaultFullName: string;
};

const LOC_TRANG_THAI: readonly RoomBookingStatusValue[] = [
  'PENDING',
  'APPROVED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'COMPLETED',
];

export function RoomCalendar({ room, staffProfile, defaultFullName }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [moc, setMoc] = useState<Date>(() => new Date());
  const [bookings, setBookings] = useState<RoomBookingListItem[]>([]);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState<string | null>(null);

  const [chiDonCuaToi, setChiDonCuaToi] = useState(false);
  const [locTo, setLocTo] = useState('');
  const [locTrangThai, setLocTrangThai] = useState<RoomBookingStatusValue | ''>('');

  const [formInitial, setFormInitial] = useState<BookingFormInitial | null>(null);
  const [donDangXem, setDonDangXem] = useState<RoomBookingListItem | null>(null);

  const days = useMemo(
    () => layDanhSachNgay(moc, viewMode, room.setting.allowWeekend),
    [moc, viewMode, room.setting.allowWeekend]
  );
  const { openMinutes, closeMinutes, stepMinutes } = layKhungGio(room.setting);

  const from = useMemo(() => vnStartOfDay(days[0] as Date), [days]);
  const to = useMemo(() => vnAddDays(vnStartOfDay(days[days.length - 1] as Date), 1), [days]);

  const taiLai = useCallback(async () => {
    setDangTai(true);
    setLoi(null);
    try {
      const params = new URLSearchParams({
        roomId: room.id,
        from: from.toISOString(),
        to: to.toISOString(),
      });
      if (chiDonCuaToi) params.set('mine', 'true');
      if (locTo) params.set('department', locTo);
      if (locTrangThai) params.set('status', locTrangThai);

      setBookings(await apiClient.get<RoomBookingListItem[]>(`/room-bookings?${params}`));
    } catch (err) {
      setLoi(err instanceof ApiError ? err.message : 'Không tải được lịch đặt phòng.');
    } finally {
      setDangTai(false);
    }
  }, [room.id, from, to, chiDonCuaToi, locTo, locTrangThai]);

  useEffect(() => {
    void taiLai();
  }, [taiLai]);

  /** Danh sách tổ chuyên môn rút từ chính dữ liệu đang có, khỏi cần endpoint riêng. */
  const danhSachTo = useMemo(() => {
    const set = new Set(bookings.map((b) => b.department).filter((d): d is string => !!d));
    return [...set].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [bookings]);

  function moFormTuSlot(selection: SlotSelection) {
    setFormInitial({
      startAt: selection.startAt,
      endAt: selection.endAt,
      staffProfile,
      defaultFullName,
    });
  }

  function moFormChoNgay(day: Date) {
    setFormInitial({
      startAt: vnDateTimeToUtc(vnDateKey(day), openMinutes),
      endAt: vnDateTimeToUtc(vnDateKey(day), Math.min(openMinutes + 120, closeMinutes)),
      staffProfile,
      defaultFullName,
    });
  }

  const nhanKhoangNgay =
    viewMode === 'day'
      ? vnDateLabel(days[0] as Date)
      : `${vnDateLabel(days[0] as Date)} – ${vnDateLabel(days[days.length - 1] as Date)}`;

  return (
    <div className="space-y-4">
      {/* Thanh điều hướng */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
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

        <div className="flex items-center gap-2">
          {/* Chế độ xem chỉ có nghĩa trên lưới; điện thoại luôn là danh sách. */}
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

          <Button size="sm" onClick={() => moFormChoNgay(days[0] as Date)}>
            <Plus className="mr-1 h-4 w-4" />
            Đăng ký
          </Button>
        </div>
      </div>

      {/* Bộ lọc */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label
          className={cn(
            'border-input hover:bg-muted/60 flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-3 transition-colors',
            chiDonCuaToi && 'border-primary/50 bg-primary/10 text-primary'
          )}
        >
          <input
            type="checkbox"
            className="accent-primary h-3.5 w-3.5"
            checked={chiDonCuaToi}
            onChange={(e) => setChiDonCuaToi(e.target.checked)}
          />
          Chỉ đơn của tôi
        </label>

        <Select
          value={locTo}
          onValueChange={(v) => setLocTo((v as string) ?? '')}
          items={[
            { label: 'Mọi tổ chuyên môn', value: '' },
            ...danhSachTo.map((to) => ({ label: to, value: to })),
          ]}
        >
          <SelectTrigger size="sm" aria-label="Lọc theo tổ chuyên môn" className="min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Mọi tổ chuyên môn</SelectItem>
            {danhSachTo.map((to) => (
              <SelectItem key={to} value={to}>
                {to}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={locTrangThai}
          onValueChange={(v) => setLocTrangThai((v as RoomBookingStatusValue | '') ?? '')}
          items={[
            { label: 'Mọi trạng thái', value: '' },
            ...LOC_TRANG_THAI.map((s) => ({ label: ROOM_BOOKING_STATUS_LABEL[s], value: s })),
          ]}
        >
          <SelectTrigger size="sm" aria-label="Lọc theo trạng thái" className="min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Mọi trạng thái</SelectItem>
            {LOC_TRANG_THAI.map((s) => (
              <SelectItem key={s} value={s}>
                <span className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_VISUAL[s].dot)} />
                  {ROOM_BOOKING_STATUS_LABEL[s]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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

      {/* Lưới cho màn hình rộng, danh sách cho điện thoại */}
      <div className="hidden md:block">
        <WeekGrid
          days={days}
          bookings={bookings}
          openMinutes={openMinutes}
          closeMinutes={closeMinutes}
          stepMinutes={stepMinutes}
          onSelectSlot={moFormTuSlot}
          onSelectBooking={setDonDangXem}
        />
      </div>
      <div className="md:hidden">
        <AgendaList
          days={days}
          bookings={bookings}
          onSelectBooking={setDonDangXem}
          onCreateForDay={moFormChoNgay}
        />
      </div>

      <div className="flex flex-col gap-2">
        <StatusLegend statuses={LOC_TRANG_THAI} />
        <p className="text-muted-foreground text-xs">
          Kéo chọn khoảng trống trên lịch để đăng ký nhanh. Khung giờ đang có đơn chờ duyệt vẫn được
          giữ chỗ.
        </p>
      </div>

      {formInitial && (
        <BookingFormDialog
          room={room}
          initial={formInitial}
          onClose={() => setFormInitial(null)}
          onSaved={() => {
            setFormInitial(null);
            void taiLai();
          }}
        />
      )}

      {donDangXem && (
        <BookingDetailDialog
          bookingId={donDangXem.id}
          onClose={() => setDonDangXem(null)}
          onChanged={() => void taiLai()}
          onEdit={(chiTiet) => {
            setDonDangXem(null);
            setFormInitial({
              bookingId: chiTiet.id,
              startAt: new Date(chiTiet.startAt),
              endAt: new Date(chiTiet.endAt),
              fullName: chiTiet.fullName,
              staffCode: chiTiet.staffCode,
              department: chiTiet.department,
              reason: chiTiet.reason,
              staffProfile,
              defaultFullName,
            });
          }}
        />
      )}
    </div>
  );
}

/** Tuần theo cấu hình phòng: đủ 7 ngày nếu cho cuối tuần, nếu không thì T2–T6. */
function layDanhSachNgay(moc: Date, mode: ViewMode, allowWeekend: boolean): Date[] {
  if (mode === 'day') return [vnStartOfDay(moc)];
  const thuHai = vnStartOfWeek(moc);
  return Array.from({ length: allowWeekend ? 7 : 5 }, (_, i) => vnAddDays(thuHai, i));
}

function layKhungGio(setting: RoomBookingSettingDto) {
  // Cấu hình hỏng thì rơi về 07:00–17:30 để lịch vẫn vẽ được thay vì trắng trang.
  const openMinutes = parseHHmm(setting.openTime) ?? 7 * 60;
  const closeMinutes = parseHHmm(setting.closeTime) ?? 17 * 60 + 30;
  const hopLe = closeMinutes > openMinutes;

  return {
    openMinutes: hopLe ? openMinutes : 7 * 60,
    closeMinutes: hopLe ? closeMinutes : 17 * 60 + 30,
    stepMinutes: displayStepMinutes(setting),
  };
}
