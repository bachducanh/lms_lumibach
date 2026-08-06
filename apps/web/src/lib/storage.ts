import * as Minio from 'minio';

// Internal endpoint: used by the server-side SDK to connect to MinIO directly.
// Must be reachable from the Node.js process (localhost or internal network).
// Falls back to MINIO_ENDPOINT so single-machine setups keep working.
const internalEndpoint =
  process.env.MINIO_INTERNAL_ENDPOINT ?? process.env.MINIO_ENDPOINT ?? 'localhost';
const internalPort = parseInt(
  process.env.MINIO_INTERNAL_PORT ?? process.env.MINIO_PORT ?? '9000',
  10
);

export const BUCKET_AVATARS = process.env.MINIO_BUCKET_AVATARS ?? 'lumibach-avatars';
export const BUCKET_FILES = process.env.MINIO_BUCKET_FILES ?? 'lumibach-files';

export const minioClient = new Minio.Client({
  endPoint: internalEndpoint,
  port: internalPort,
  useSSL: false, // internal connection is always plain HTTP
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin_password',
});

export function isMinioConfigured(): boolean {
  return !!(process.env.MINIO_ACCESS_KEY && process.env.MINIO_SECRET_KEY);
}

export async function ensureBucket(bucket: string): Promise<void> {
  const exists = await minioClient.bucketExists(bucket);
  if (!exists) {
    await minioClient.makeBucket(bucket);
    const policy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    });
    await minioClient.setBucketPolicy(bucket, policy);
  }
}

// Origin công khai của MinIO (ví dụ https://media.lumibach.com). Để TRỐNG thì URL
// sinh ra là đường dẫn tương đối và file đi qua rewrite /storage/* của Next.js —
// đúng cho localhost và cho máy khác trong mạng LAN.
const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_URL ?? '').replace(/\/$/, '');

// Miền của web cũng phục vụ /storage/* (qua rewrite bên dưới), nên URL tuyệt đối
// trỏ về chính nó vẫn là storage của mình. Giữ khớp với
// apps/api/src/common/storage/storage-url.ts.
const APP_BASE = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

const TRUSTED_BASES = [MEDIA_BASE, APP_BASE].filter(Boolean);

const KNOWN_BUCKETS = new Set([BUCKET_AVATARS, BUCKET_FILES]);

/**
 * URL công khai của một object.
 *
 * - Có miền media: sinh đúng đường dẫn gốc của MinIO `<media>/<bucket>/<object>`,
 *   để trình duyệt gọi thẳng mà KHÔNG cần Transform Rule cắt tiền tố ở Cloudflare.
 * - Không có miền media: đường dẫn tương đối `/storage/…`, đi qua rewrite của
 *   Next.js — đúng cho localhost và cho máy khác trong mạng LAN.
 */
export function getPublicUrl(bucket: string, objectName: string): string {
  return MEDIA_BASE ? `${MEDIA_BASE}/${bucket}/${objectName}` : `/storage/${bucket}/${objectName}`;
}

/**
 * URL do hệ thống sinh ra → đường dẫn chuẩn `/storage/<bucket>/<object>`.
 *
 * Mọi chỗ trong hệ thống so khớp theo dạng này (dọn file rác, guard chặn link
 * ngoài), nên đây là nơi duy nhất phải biết các biến thể URL.
 *
 * Trả `null` nếu URL không trỏ vào storage của mình — đây là chốt chặn ngăn
 * `javascript:` và link ngoài lọt vào DB, nên phải so khớp tiền tố nguyên văn.
 * KHÔNG dùng `new URL().pathname`: `https://evil.com/storage/…` cũng cho ra
 * pathname hợp lệ và sẽ qua mặt được guard.
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
