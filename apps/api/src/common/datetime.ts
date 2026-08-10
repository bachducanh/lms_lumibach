/**
 * Chuyển chuỗi ngày giờ nhận từ client thành Date (instant) để lưu xuống DB.
 *
 * BẪY: `<input type="datetime-local">` cho ra chuỗi giờ treo tường KHÔNG kèm
 * múi giờ, ví dụ "2026-08-10T08:00". Theo chuẩn ECMAScript, `new Date(chuỗi đó)`
 * hiểu theo múi giờ của tiến trình. Container chạy UTC nên giáo viên đặt "mở từ
 * 8:00" lại thành 08:00Z = 15:00 giờ Việt Nam — học sinh vào trước 15:00 vẫn
 * thấy "bài tập chưa mở".
 *
 * Vì vậy: chuỗi nào KHÔNG có chỉ định múi giờ thì hiểu theo giờ Việt Nam
 * (UTC+7), còn chuỗi đã có 'Z' hoặc '+hh:mm' thì giữ nguyên.
 */
const APP_UTC_OFFSET = '+07:00';

/** "2026-08-10T08:00" | "2026-08-10T08:00:00" | "2026-08-10T08:00:00.000" */
const NAIVE_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;
/** "2026-08-10" */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = value.trim();
  let normalized = raw;
  if (DATE_ONLY.test(raw)) {
    // Chuỗi chỉ có ngày mặc định là 00:00 UTC theo chuẩn — ép về 00:00 giờ VN.
    normalized = `${raw}T00:00:00${APP_UTC_OFFSET}`;
  } else if (NAIVE_DATE_TIME.test(raw)) {
    normalized = `${raw.replace(' ', 'T')}${APP_UTC_OFFSET}`;
  }

  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}
