import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import sharp from 'sharp';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { hasMinRole } from '@/lib/permissions';
import { minioClient, BUCKET_HANDOVERS, ensureBucket, isMinioConfigured } from '@/lib/storage';
import { vnDateTimeLabel } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Cạnh dài tối đa sau khi nén. Ảnh điện thoại 4000px không giúp gì cho việc đối chiếu. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 80;

/**
 * Nhận ảnh minh chứng bàn giao.
 *
 * Toàn bộ xử lý nằm ở phía máy chủ, cố ý không tin gì từ trình duyệt:
 *
 * - **Thời gian là của máy chủ.** Watermark đóng giờ máy chủ, không phải giờ
 *   máy người dùng và cũng không phải EXIF — cả hai đều sửa được.
 * - **Xoá sạch EXIF.** `sharp` mặc định không giữ metadata, nên toạ độ GPS và
 *   thông tin thiết bị không bị lưu lại cùng ảnh.
 * - **Xoay theo EXIF TRƯỚC khi xoá.** `.rotate()` không tham số đọc thẻ
 *   Orientation rồi xoay pixel thật; bỏ bước này thì ảnh chụp dọc bằng điện
 *   thoại sẽ nằm ngang sau khi metadata bị gỡ.
 * - **`sha256` tính trên ảnh ĐÃ xử lý**, tức đúng thứ được lưu, nên về sau đối
 *   chiếu được để phát hiện ảnh bị thay.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  if (!session?.user?.id) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (!hasMinRole(role, 'TA'))
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  if (!isMinioConfigured())
    return NextResponse.json({ error: 'Storage chưa được cấu hình' }, { status: 503 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const bookingId = formData.get('bookingId');
  const capturedAtClient = formData.get('capturedAtClient');

  if (!file) return NextResponse.json({ error: 'Không có ảnh' }, { status: 400 });
  if (!ALLOWED.has(file.type))
    return NextResponse.json({ error: 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP' }, { status: 400 });
  if (file.size <= 0) return NextResponse.json({ error: 'Ảnh rỗng' }, { status: 400 });
  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: 'Ảnh tối đa 10 MB' }, { status: 400 });
  if (typeof bookingId !== 'string' || !bookingId)
    return NextResponse.json({ error: 'Thiếu mã đơn mượn phòng' }, { status: 400 });

  // Chỉ chủ đơn được gắn ảnh vào đơn của mình. Kiểm ngay ở bước tải lên chứ
  // không đợi lúc nộp bàn giao: ảnh đã nằm trong storage rồi thì chặn muộn
  // cũng không gỡ được gì.
  const booking = await prisma.roomBooking.findUnique({
    where: { id: bookingId },
    select: { userId: true, fullName: true, room: { select: { name: true } } },
  });

  if (!booking)
    return NextResponse.json({ error: 'Đơn mượn phòng không tồn tại' }, { status: 404 });
  if (booking.userId !== session.user.id) {
    return NextResponse.json({ error: 'Bạn chỉ gắn ảnh vào đơn của chính mình' }, { status: 403 });
  }

  try {
    await ensureBucket(BUCKET_HANDOVERS);

    const goc = Buffer.from(await file.arrayBuffer());
    const serverReceivedAt = new Date();

    const { buffer, width, height } = await xuLyAnh(goc, {
      roomName: booking.room.name,
      fullName: booking.fullName,
      bookingId,
      serverReceivedAt,
    });

    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const objectName = `handover-photos/${session.user.id}/${randomBytes(10).toString('hex')}.jpg`;

    await minioClient.putObject(BUCKET_HANDOVERS, objectName, buffer, buffer.length, {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, max-age=0, no-store',
    });

    return NextResponse.json({
      photo: {
        bucket: BUCKET_HANDOVERS,
        objectName,
        mime: 'image/jpeg',
        size: buffer.length,
        sha256,
        width,
        height,
        capturedAtClient:
          typeof capturedAtClient === 'string' && capturedAtClient ? capturedAtClient : null,
      },
    });
  } catch (err) {
    console.error('[HANDOVER PHOTO UPLOAD]', err);
    return NextResponse.json({ error: 'Upload ảnh thất bại, thử lại sau' }, { status: 500 });
  }
}

type WatermarkInfo = {
  roomName: string;
  fullName: string;
  bookingId: string;
  serverReceivedAt: Date;
};

/** Xoay theo EXIF, thu nhỏ, nén, rồi dán dải watermark ở đáy ảnh. */
export async function xuLyAnh(goc: Buffer, info: WatermarkInfo) {
  const { data, info: meta } = await sharp(goc)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer({ resolveWithObject: true });

  const overlay = Buffer.from(dungWatermarkSvg(meta.width, meta.height, info));

  const cuoiCung = await sharp(data)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  return { buffer: cuoiCung, width: meta.width, height: meta.height };
}

/**
 * Watermark dựng bằng SVG rồi dán đè, thay vì vẽ chữ bằng thư viện font —
 * `sharp` không có API vẽ chữ, còn SVG thì không phải cài thêm gì.
 *
 * Cỡ chữ tính theo chiều rộng ảnh để ảnh nhỏ vẫn đọc được mà ảnh lớn không bị
 * chữ quá khổ. Nền tối mờ để chữ trắng nổi trên mọi ảnh, kể cả ảnh ngược sáng.
 */
export function dungWatermarkSvg(width: number, height: number, info: WatermarkInfo): string {
  const co = Math.max(11, Math.round(width / 46));
  const dem = Math.round(co * 0.55);
  const caoDai = co * 2 + dem * 3;
  const dinhDai = Math.max(0, height - caoDai);

  const dong1 = `${vnDateTimeLabel(info.serverReceivedAt)} · ${info.roomName}`;
  const dong2 = `${info.fullName} · Đơn ${info.bookingId.slice(-8).toUpperCase()}`;

  // Độ mờ khai bằng `fill-opacity` — dạng chuẩn SVG 1.1. `rgba()` trong `fill`
  // thực tế cũng dựng đúng với librsvg hiện tại, nhưng đó là cú pháp CSS Color
  // nên phụ thuộc phiên bản thư viện; dùng thuộc tính chuẩn thì chắc chắn hơn.
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="${dinhDai}" width="${width}" height="${caoDai}" fill="#000000" fill-opacity="0.55"/>
  <text x="${dem}" y="${dinhDai + dem + co}" font-family="sans-serif" font-size="${co}"
        font-weight="bold" fill="#ffffff">${thoat(dong1)}</text>
  <text x="${dem}" y="${dinhDai + dem * 2 + co * 2}" font-family="sans-serif" font-size="${co}"
        fill="#e5e5e5">${thoat(dong2)}</text>
</svg>`;
}

/** Tên phòng và họ tên do người dùng nhập nên phải thoát trước khi nhúng vào SVG. */
function thoat(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
