/**
 * Quy đổi giữa UTC và giờ Việt Nam, dùng chung cho cả FE và BE.
 *
 * Vì sao tự viết thay vì dùng thư viện múi giờ: Việt Nam ở UTC+7 cố định và
 * KHÔNG có giờ mùa hè (bỏ từ 1975). Với một múi giờ có độ lệch cố định thì phép
 * cộng/trừ 7 tiếng là chính xác tuyệt đối, không cần bảng IANA. Nếu sau này hệ
 * thống phải phục vụ múi giờ khác thì phải thay toàn bộ file này bằng thư viện
 * thật (`@date-fns/tz`), đừng vá từng chỗ.
 *
 * Quy ước xuyên suốt: mọi `Date` trong hệ thống là mốc thời gian tuyệt đối (lưu
 * UTC trong CSDL). Các hàm ở đây chỉ dùng để ĐỌC ra thành phần theo giờ Việt Nam
 * và DỰNG mốc thời gian từ thành phần giờ Việt Nam. Không bao giờ so sánh giờ
 * bằng chuỗi.
 */

export const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const VN_UTC_OFFSET_MINUTES = 7 * 60;

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 24 * 60;

/** Các thành phần lịch của một mốc thời gian, đọc theo giờ Việt Nam. */
export type VnParts = {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
  hour: number;
  minute: number;
  /** 0 = Chủ nhật … 6 = Thứ bảy */
  weekday: number;
};

/**
 * Dịch mốc thời gian sang "đồng hồ Việt Nam" rồi đọc bằng các hàm getUTC*.
 * Kết quả KHÔNG còn là mốc thời gian đúng nữa — chỉ dùng nội bộ file này.
 */
function toVnClock(date: Date): Date {
  return new Date(date.getTime() + VN_UTC_OFFSET_MINUTES * MS_PER_MINUTE);
}

export function vnParts(date: Date): VnParts {
  const c = toVnClock(date);
  return {
    year: c.getUTCFullYear(),
    month: c.getUTCMonth() + 1,
    day: c.getUTCDate(),
    hour: c.getUTCHours(),
    minute: c.getUTCMinutes(),
    weekday: c.getUTCDay(),
  };
}

/** Số phút tính từ 00:00 giờ Việt Nam của ngày hôm đó. */
export function vnMinutesOfDay(date: Date): number {
  const { hour, minute } = vnParts(date);
  return hour * 60 + minute;
}

/** Khoá ngày dạng `yyyy-MM-dd` theo giờ Việt Nam — dùng để gom đơn theo cột lịch. */
export function vnDateKey(date: Date): string {
  const { year, month, day } = vnParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Thứ 7 hoặc Chủ nhật theo giờ Việt Nam. */
export function isVnWeekend(date: Date): boolean {
  const w = vnParts(date).weekday;
  return w === 0 || w === 6;
}

/**
 * Dựng mốc thời gian từ ngày (`yyyy-MM-dd`) và số phút trong ngày, hiểu theo
 * giờ Việt Nam. `minutesOfDay` được phép vượt 1440 để biểu diễn mốc sang ngày
 * hôm sau (ví dụ slot kết thúc lúc 24:00).
 */
export function vnDateTimeToUtc(dateKey: string, minutesOfDay: number): Date {
  const [year, month, day] = dateKey.split('-').map(Number) as [number, number, number];
  const utcMidnight = Date.UTC(year, month - 1, day);
  return new Date(utcMidnight + (minutesOfDay - VN_UTC_OFFSET_MINUTES) * MS_PER_MINUTE);
}

/** Nửa đêm (00:00 giờ Việt Nam) của ngày chứa `date`. */
export function vnStartOfDay(date: Date): Date {
  return vnDateTimeToUtc(vnDateKey(date), 0);
}

/** Cộng thêm `days` ngày lịch Việt Nam, giữ nguyên giờ trong ngày. */
export function vnAddDays(date: Date, days: number): Date {
  const { hour, minute } = vnParts(date);
  const base = vnStartOfDay(date);
  const shifted = new Date(base.getTime() + days * MINUTES_PER_DAY * MS_PER_MINUTE);
  return vnDateTimeToUtc(vnDateKey(shifted), hour * 60 + minute);
}

/**
 * Thứ Hai (00:00 giờ Việt Nam) của tuần chứa `date`. Tuần bắt đầu từ Thứ Hai
 * theo thói quen Việt Nam, không phải Chủ nhật như mặc định của JavaScript.
 */
export function vnStartOfWeek(date: Date): Date {
  const w = vnParts(date).weekday;
  const lui = w === 0 ? 6 : w - 1; // Chủ nhật lùi 6 ngày, còn lại lùi w-1
  return vnStartOfDay(vnAddDays(date, -lui));
}

/** Số ngày lịch Việt Nam giữa hai mốc (b - a), tính theo ngày chứ không theo giờ. */
export function vnDaysBetween(a: Date, b: Date): number {
  const diff = vnStartOfDay(b).getTime() - vnStartOfDay(a).getTime();
  return Math.round(diff / (MINUTES_PER_DAY * MS_PER_MINUTE));
}

// ── Nhãn hiển thị ──────────────────────────────────────────────

/** `HH:mm` giờ Việt Nam, định dạng 24 giờ. */
export function vnTimeLabel(date: Date): string {
  const { hour, minute } = vnParts(date);
  return `${pad(hour)}:${pad(minute)}`;
}

/** `dd/MM/yyyy` giờ Việt Nam. */
export function vnDateLabel(date: Date): string {
  const { year, month, day } = vnParts(date);
  return `${pad(day)}/${pad(month)}/${year}`;
}

/** `dd/MM/yyyy HH:mm` giờ Việt Nam. */
export function vnDateTimeLabel(date: Date): string {
  return `${vnDateLabel(date)} ${vnTimeLabel(date)}`;
}

/** `HH:mm – HH:mm dd/MM/yyyy`, gọn cho một khung giờ trong cùng ngày. */
export function vnRangeLabel(start: Date, end: Date): string {
  const cungNgay = vnDateKey(start) === vnDateKey(end);
  return cungNgay
    ? `${vnTimeLabel(start)} – ${vnTimeLabel(end)} ${vnDateLabel(start)}`
    : `${vnDateTimeLabel(start)} – ${vnDateTimeLabel(end)}`;
}

export const VN_WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

/** `T2`, `T3`… theo giờ Việt Nam. */
export function vnWeekdayLabel(date: Date): string {
  return VN_WEEKDAY_LABELS[vnParts(date).weekday] as string;
}

// ── Chuỗi HH:mm ────────────────────────────────────────────────

/** `'07:30'` → 450. Trả về null nếu chuỗi không đúng dạng. */
export function parseHHmm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 24 || minute > 59) return null;
  const total = hour * 60 + minute;
  return total > MINUTES_PER_DAY ? null : total;
}

/** 450 → `'07:30'`. */
export function formatHHmm(minutesOfDay: number): string {
  const h = Math.floor(minutesOfDay / 60);
  const m = minutesOfDay % 60;
  return `${pad(h)}:${pad(m)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
