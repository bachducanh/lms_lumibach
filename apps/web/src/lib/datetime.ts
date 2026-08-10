/**
 * Cầu nối giữa `<input type="datetime-local">` (giờ treo tường, không múi giờ)
 * và instant ISO mà API lưu xuống DB.
 *
 * Không gửi thẳng value của input lên API: chuỗi "2026-08-10T08:00" không có
 * múi giờ nên phía server hiểu theo giờ tiến trình (container chạy UTC), mốc
 * lưu xuống lệch 7 tiếng so với ý của giáo viên và học sinh thấy "chưa mở".
 * API cũng đã tự bù (xem apps/api/src/common/datetime.ts) nhưng gửi ISO đủ
 * múi giờ là cách chắc chắn, không phụ thuộc TZ của bất kỳ tiến trình nào.
 */
const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** Instant (ISO/Date) -> "YYYY-MM-DDTHH:MM" theo giờ Việt Nam, để đổ vào input. */
export function toLocalInputValue(d: string | Date | null | undefined): string {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';

  // Dùng formatToParts với timeZone cố định thay cho getFullYear()/getHours():
  // component này cũng render trên server (SSR), nơi giờ máy là UTC.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(dt);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';
  // hour12: false vẫn có thể trả "24" cho nửa đêm ở một số runtime.
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

/**
 * Hiển thị ngày giờ theo giờ Việt Nam, không phụ thuộc TZ của tiến trình.
 *
 * Bắt buộc ghim timeZone: các trang này render trên server (SSR), container
 * chạy UTC nên nếu để mặc định thì giáo viên đọc được mốc lệch 7 tiếng so với
 * mốc thật đang chặn học sinh — hỏng đúng chỗ khó ngờ nhất.
 */
export function formatDateTime(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt);
}

/** "YYYY-MM-DDTHH:MM" (giờ Việt Nam) -> ISO instant để gửi lên API. */
export function localInputToIso(v: string | null | undefined): string | null {
  if (!v) return null;
  // Input có thể là "...THH:MM" hoặc "...THH:MM:SS" tuỳ trình duyệt.
  const withSeconds = /T\d{2}:\d{2}$/.test(v) ? `${v}:00` : v;
  const d = new Date(`${withSeconds}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
