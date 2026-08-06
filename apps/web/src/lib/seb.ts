// Helpers cho chế độ kiểm tra Safe Exam Browser (SEB).
// Dùng ở Server Component: truyền vào đối tượng Headers lấy từ `await headers()`.

export type SebActivityKind = 'quiz' | 'practice-test';

/**
 * Phát hiện request có đến từ Safe Exam Browser hay không.
 *
 * SEB gắn "SEB/<version>" vào User-Agent, và khi giáo viên bật Browser Exam Key /
 * Config Key trong file .seb thì còn gửi kèm các header `X-SafeExamBrowser-*`.
 * Ta chấp nhận một trong các dấu hiệu này — đủ để chặn trình duyệt thường.
 */
export function isSafeExamBrowser(h: Headers): boolean {
  const ua = (h.get('user-agent') ?? '').toLowerCase();
  if (ua.includes('seb/') || ua.includes('safeexambrowser')) return true;
  return (
    !!h.get('x-safeexambrowser-requesthash') ||
    !!h.get('x-safeexambrowser-configkeyhash') ||
    !!h.get('x-safeexambrowser-confighash')
  );
}

function requestHost(h: Headers): string | null {
  return h.get('x-forwarded-host') ?? h.get('host');
}

function isLocalHost(host: string): boolean {
  const name = (host.split(':')[0] ?? '').toLowerCase();
  return (
    name === 'localhost' || name === '127.0.0.1' || name === '[::1]' || name.endsWith('.localhost')
  );
}

/**
 * Giao thức thật của request. Sau reverse-proxy/tunnel thì `x-forwarded-proto`
 * là nguồn tin cậy; khi chạy dev trên localhost (không proxy) thì luôn là http —
 * đoán https ở đây sẽ tạo ra link `sebs://localhost:3000` mà SEB không tải được.
 */
function requestProto(h: Headers, host: string): 'http' | 'https' {
  const forwarded = h.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwarded === 'http' || forwarded === 'https') return forwarded;
  return isLocalHost(host) ? 'http' : 'https';
}

/** Origin đầy đủ của request, ví dụ `http://localhost:3000`. */
export function requestOrigin(h: Headers): string | null {
  const host = requestHost(h);
  if (!host) return null;
  return `${requestProto(h, host)}://${host}`;
}

/**
 * Đường dẫn tới file cấu hình .seb sinh động cho một hoạt động. Endpoint này
 * lấy file mẫu giáo viên đã tải lên rồi ghi đè `startURL` trỏ thẳng vào hoạt
 * động, nhờ đó SEB mở ra là vào đúng bài chứ không dừng ở landing page.
 */
export function sebConfigPath(kind: SebActivityKind, id: string): string {
  return `/api/seb/${kind}/${id}.seb`;
}

/**
 * Link để mở file cấu hình bằng SEB đã cài trên máy. SEB đăng ký giao thức
 * `seb://` (HTTP) và `sebs://` (HTTPS): mở link sẽ khiến SEB tải file cấu hình
 * rồi điều hướng tới URL bắt đầu (chính là bài thi).
 */
export function sebLaunchUrl(h: Headers, kind: SebActivityKind, id: string): string | null {
  const host = requestHost(h);
  if (!host) return null;
  const scheme = requestProto(h, host) === 'http' ? 'seb' : 'sebs';
  return `${scheme}://${host}${sebConfigPath(kind, id)}`;
}
