import { BadRequestException } from '@nestjs/common';
import {
  formatHHmm,
  isVnWeekend,
  parseHHmm,
  vnDateKey,
  vnDaysBetween,
  vnMinutesOfDay,
  vnRangeLabel,
  type RoomBookingSettingDto,
} from '@lumibach/types';

/**
 * Lớp kiểm tra thứ HAI trong ba lớp chống đặt sai (UI → service → CSDL).
 *
 * Toàn bộ là hàm thuần, không chạm CSDL: nhận khung giờ + tham số cấu hình, trả
 * về danh sách lỗi. Nhờ vậy test được đầy đủ mà không cần dựng database, và
 * dùng lại được cho cả đơn mượn phòng lẫn đơn mượn thiết bị.
 *
 * Ràng buộc chống TRÙNG GIỜ không nằm ở đây — đó là việc của ràng buộc EXCLUDE
 * ở tầng CSDL, xem migration add_function_rooms.
 */

export type BookingWindow = {
  startAt: Date;
  endAt: Date;
};

export type ValidationContext = {
  setting: RoomBookingSettingDto;
  /** Thời điểm "bây giờ", truyền vào để test không phụ thuộc đồng hồ máy. */
  now: Date;
  /** Admin được bỏ qua các ràng buộc về lịch (đặt hộ, xử lý ngoại lệ). */
  isAdmin: boolean;
};

/** Một lỗi ràng buộc, đã sẵn sàng hiển thị cho người dùng. */
export type BookingRuleError = {
  code: string;
  message: string;
};

export function validateBookingWindow(
  window: BookingWindow,
  ctx: ValidationContext
): BookingRuleError[] {
  const errors: BookingRuleError[] = [];
  const { startAt, endAt } = window;
  const { setting, now, isAdmin } = ctx;

  // ── Kiểm tra cơ bản, áp dụng cho cả admin ──────────────────
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return [{ code: 'INVALID_DATE', message: 'Thời gian không hợp lệ.' }];
  }

  if (endAt.getTime() <= startAt.getTime()) {
    return [{ code: 'END_BEFORE_START', message: 'Giờ kết thúc phải sau giờ bắt đầu.' }];
  }

  const soPhut = (endAt.getTime() - startAt.getTime()) / 60_000;

  // Đơn phải nằm gọn trong một ngày: lịch tuần vẽ theo cột ngày, và việc bàn
  // giao chìa khoá qua đêm cần quy trình riêng chưa có trong phạm vi này.
  if (vnDateKey(startAt) !== vnDateKey(endAt)) {
    errors.push({
      code: 'CROSS_DAY',
      message: 'Mỗi lượt mượn phải nằm trong cùng một ngày.',
    });
  }

  if (isAdmin) return errors;

  // ── Các ràng buộc chỉ áp cho giáo viên / trợ giảng ─────────
  if (startAt.getTime() <= now.getTime()) {
    errors.push({
      code: 'IN_THE_PAST',
      message: 'Không đặt được khung giờ đã qua.',
    });
  }

  const soNgayTruoc = vnDaysBetween(now, startAt);
  if (soNgayTruoc > setting.maxAdvanceDays) {
    errors.push({
      code: 'TOO_FAR_AHEAD',
      message: `Chỉ được đặt trước tối đa ${setting.maxAdvanceDays} ngày.`,
    });
  }

  if (soPhut < setting.minDurationMinutes) {
    errors.push({
      code: 'TOO_SHORT',
      message: `Mỗi lượt mượn tối thiểu ${moTaThoiLuong(setting.minDurationMinutes)}.`,
    });
  }

  if (soPhut > setting.maxDurationMinutes) {
    errors.push({
      code: 'TOO_LONG',
      message: `Mỗi lượt mượn tối đa ${moTaThoiLuong(setting.maxDurationMinutes)}.`,
    });
  }

  if (!setting.allowWeekend && (isVnWeekend(startAt) || isVnWeekend(endAt))) {
    errors.push({
      code: 'WEEKEND',
      message: 'Phòng không mở vào Thứ bảy và Chủ nhật.',
    });
  }

  errors.push(...kiemTraGioMoCua(window, setting));
  errors.push(...kiemTraBuocSlot(window, setting));

  return errors;
}

/** Ném luôn BadRequestException với thông báo gộp, nếu có lỗi. */
export function assertBookingWindow(window: BookingWindow, ctx: ValidationContext): void {
  const errors = validateBookingWindow(window, ctx);
  if (errors.length === 0) return;

  throw new BadRequestException({
    code: 'BOOKING_RULE_VIOLATION',
    message: errors.map((e) => e.message).join(' '),
    details: errors,
  });
}

function kiemTraGioMoCua(
  { startAt, endAt }: BookingWindow,
  setting: RoomBookingSettingDto
): BookingRuleError[] {
  const mo = parseHHmm(setting.openTime);
  const dong = parseHHmm(setting.closeTime);

  // Cấu hình hỏng thì bỏ qua ràng buộc này thay vì chặn hết mọi đơn — admin sẽ
  // thấy giờ mở cửa hiển thị sai trên giao diện và tự sửa.
  if (mo === null || dong === null || mo >= dong) return [];

  const batDau = vnMinutesOfDay(startAt);
  const ketThuc = vnMinutesOfDay(endAt);

  if (batDau < mo || ketThuc > dong) {
    return [
      {
        code: 'OUTSIDE_OPEN_HOURS',
        message: `Chỉ đặt được trong giờ mở cửa ${formatHHmm(mo)}–${formatHHmm(dong)}.`,
      },
    ];
  }

  return [];
}

function kiemTraBuocSlot(
  { startAt, endAt }: BookingWindow,
  setting: RoomBookingSettingDto
): BookingRuleError[] {
  const buoc = setting.slotStepMinutes;
  if (!buoc || buoc <= 0) return [];

  const batDau = vnMinutesOfDay(startAt);
  const ketThuc = vnMinutesOfDay(endAt);

  if (batDau % buoc !== 0 || ketThuc % buoc !== 0) {
    return [
      {
        code: 'NOT_ON_SLOT',
        message: `Giờ bắt đầu và kết thúc phải rơi vào mốc ${buoc} phút.`,
      },
    ];
  }

  return [];
}

function moTaThoiLuong(phut: number): string {
  if (phut < 60) return `${phut} phút`;
  const gio = Math.floor(phut / 60);
  const du = phut % 60;
  return du === 0 ? `${gio} tiếng` : `${gio} tiếng ${du} phút`;
}

/**
 * Cửa sổ cho phép nhận phòng: quanh giờ bắt đầu ±`checkinWindowMinutes`, và
 * không quá giờ kết thúc. Ngoài khoảng này thì cần admin mở khoá.
 */
export function canCheckInNow(
  window: BookingWindow,
  setting: RoomBookingSettingDto,
  now: Date
): boolean {
  const som = window.startAt.getTime() - setting.checkinWindowMinutes * 60_000;
  return now.getTime() >= som && now.getTime() <= window.endAt.getTime();
}

/** Thông báo giải thích vì sao chưa nhận phòng được, dùng khi canCheckInNow sai. */
export function checkInWindowMessage(
  window: BookingWindow,
  setting: RoomBookingSettingDto,
  now: Date
): string {
  if (now.getTime() > window.endAt.getTime()) {
    return `Đã quá giờ sử dụng (${vnRangeLabel(window.startAt, window.endAt)}). Vui lòng liên hệ Quản trị viên.`;
  }
  return `Chỉ nhận phòng được từ ${setting.checkinWindowMinutes} phút trước giờ bắt đầu. Vui lòng quay lại sau.`;
}
