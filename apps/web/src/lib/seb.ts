// Helpers cho chế độ kiểm tra Safe Exam Browser (SEB).
// Dùng ở Server Component: truyền vào đối tượng Headers lấy từ `await headers()`.

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

/**
 * Link để mở file cấu hình bằng SEB đã cài trên máy. SEB đăng ký giao thức
 * `seb://` (HTTP) và `sebs://` (HTTPS): mở link sẽ khiến SEB tải file cấu hình
 * rồi điều hướng tới URL bắt đầu (chính là bài thi). `configUrl` là đường dẫn
 * tương đối dạng `/storage/...`.
 */
export function sebLaunchUrl(h: Headers, configUrl: string | null | undefined): string | null {
  if (!configUrl) return null;
  const host = requestHost(h);
  if (!host) return null;
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const scheme = proto === 'http' ? 'seb' : 'sebs';
  const path = configUrl.startsWith('/') ? configUrl : `/${configUrl}`;
  return `${scheme}://${host}${path}`;
}
