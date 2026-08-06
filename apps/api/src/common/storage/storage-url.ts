// Origin công khai của MinIO (ví dụ https://media.lumibach.com). Phải khớp
// NEXT_PUBLIC_MEDIA_URL mà apps/web dùng để sinh URL — xem apps/web/src/lib/storage.ts.
const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_URL ?? '').replace(/\/$/, '');

// Miền của web cũng phục vụ /storage/* (qua rewrite của Next.js), nên URL tuyệt
// đối trỏ về chính nó vẫn là storage của mình.
const APP_BASE = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

const TRUSTED_BASES = [MEDIA_BASE, APP_BASE].filter(Boolean);

// Cấu hình phải khớp apps/web/src/lib/storage.ts — cùng trỏ vào một MinIO.
// Chỉ 2 bucket này thuộc hệ thống; máy MinIO có thể còn bucket của dự án khác.
export const KNOWN_BUCKETS = new Set([
  process.env.MINIO_BUCKET_AVATARS ?? 'lumibach-avatars',
  process.env.MINIO_BUCKET_FILES ?? 'lumibach-files',
]);

/**
 * URL do hệ thống sinh ra → đường dẫn chuẩn `/storage/<bucket>/<object>`.
 * Trả `null` nếu URL không trỏ vào storage của mình.
 *
 * Dùng cho các guard nhận dữ liệu từ client (ví dụ danh sách file học sinh nộp),
 * nên phải so khớp tiền tố nguyên văn: `new URL().pathname` sẽ khiến
 * `https://evil.com/storage/…` cho ra pathname hợp lệ và qua mặt được guard.
 *
 * Nhận 3 dạng, để dữ liệu lưu ở mọi giai đoạn trước đây đều còn dùng được:
 *   /storage/<bucket>/<object>            — tương đối (chưa bật miền media)
 *   <app|media>/storage/<bucket>/<object> — tuyệt đối, dạng cũ có tiền tố
 *   <media>/<bucket>/<object>             — tuyệt đối, dạng hiện hành
 */
export function toStoragePath(url: string): string | null {
  if (url.startsWith('/storage/')) return url;
  for (const base of TRUSTED_BASES) {
    if (url.startsWith(`${base}/storage/`)) return url.slice(base.length);
  }
  if (MEDIA_BASE && url.startsWith(`${MEDIA_BASE}/`)) {
    const rest = url.slice(MEDIA_BASE.length + 1);
    const slash = rest.indexOf('/');
    // Kiểm tên bucket: chặn URL trỏ tới bucket của dự án khác trên cùng máy MinIO.
    // `slash < rest.length - 1`: phải có tên object, không nhận `<media>/<bucket>/`.
    if (slash > 0 && slash < rest.length - 1 && KNOWN_BUCKETS.has(rest.slice(0, slash))) {
      return `/storage/${rest}`;
    }
  }
  return null;
}
