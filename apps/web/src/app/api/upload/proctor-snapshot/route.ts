import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import sharp from 'sharp';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { minioClient, BUCKET_PROCTORING, ensureBucket, isMinioConfigured } from '@/lib/storage';

const MAX_SIZE = 4 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Cạnh dài tối đa sau khi nén — đủ đọc chữ trên màn hình 1080p. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 72;

/**
 * Trần số ảnh. Client tự giới hạn số lần chụp cho mỗi lượt rời, nhưng máy chủ
 * không tin client: chốt ở đây để một trình duyệt lỗi/cố tình không lấp đầy MinIO.
 */
const MAX_PER_EVENT = 6;
const MAX_PER_ATTEMPT = 150;

const LEAVE_TYPES = new Set(['TAB_HIDDEN', 'WINDOW_BLUR', 'PAGE_LEFT']);

/**
 * Sau khi bài đã nộp vẫn nhận ảnh của lượt rời bắt đầu TRƯỚC lúc nộp, trong
 * khoảng này. Lượt rời vượt giới hạn làm máy chủ tự nộp ngay, trong khi ảnh của
 * chính lượt đó còn đang được chụp — đó lại là minh chứng quan trọng nhất. Hết
 * giờ tự nộp lúc học sinh đang ở ngoài cũng rơi vào trường hợp này. Lịch chụp ở
 * client kéo dài tới 90 giây.
 */
const AFTER_SUBMIT_GRACE_MS = 3 * 60 * 1000;

/**
 * Nhận ảnh chụp màn hình minh chứng lúc học sinh rời trang làm quiz.
 *
 * Giống ảnh bàn giao phòng, mọi thứ quyết định ở máy chủ:
 * - Chỉ nhận ảnh cho lượt làm của CHÍNH học sinh, quiz có bật chụp màn hình,
 *   và gắn vào một lượt rời bài đã được ghi trước đó khi bài còn đang làm.
 * - Watermark đóng giờ MÁY CHỦ + họ tên + tên quiz, nên ảnh cắt ra khỏi hệ thống
 *   vẫn biết là của ai, lúc nào.
 * - `sha256` tính trên ảnh đã lưu để về sau đối chiếu nếu có tranh chấp.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (!isMinioConfigured())
    return NextResponse.json({ error: 'Storage chưa được cấu hình' }, { status: 503 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const attemptId = formData.get('attemptId');
  const eventId = formData.get('eventId');
  const capturedAtClient = formData.get('capturedAtClient');

  if (!file) return NextResponse.json({ error: 'Không có ảnh' }, { status: 400 });
  if (!ALLOWED.has(file.type))
    return NextResponse.json({ error: 'Định dạng ảnh không hợp lệ' }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_SIZE)
    return NextResponse.json({ error: 'Kích thước ảnh không hợp lệ' }, { status: 400 });
  if (typeof attemptId !== 'string' || !attemptId || typeof eventId !== 'string' || !eventId)
    return NextResponse.json({ error: 'Thiếu thông tin lượt làm' }, { status: 400 });

  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    select: {
      studentId: true,
      status: true,
      submittedAt: true,
      quiz: { select: { title: true, proctorEnabled: true, proctorScreenshot: true } },
      student: { select: { fullName: true, firstName: true, lastName: true } },
    },
  });
  if (!attempt || attempt.studentId !== session.user.id)
    return NextResponse.json({ error: 'Không tìm thấy lượt làm' }, { status: 404 });
  if (!attempt.quiz.proctorEnabled || !attempt.quiz.proctorScreenshot)
    return NextResponse.json({ error: 'Quiz này không bật chụp màn hình' }, { status: 403 });

  const event = await prisma.quizProctorEvent.findUnique({
    where: { id: eventId },
    select: { attemptId: true, type: true, occurredAt: true },
  });
  if (!event || event.attemptId !== attemptId || !LEAVE_TYPES.has(event.type))
    return NextResponse.json({ error: 'Lượt rời bài không hợp lệ' }, { status: 400 });

  if (attempt.status !== 'IN_PROGRESS') {
    const leftBeforeSubmit =
      !!attempt.submittedAt && event.occurredAt.getTime() <= attempt.submittedAt.getTime();
    const withinGrace = Date.now() - event.occurredAt.getTime() <= AFTER_SUBMIT_GRACE_MS;
    if (!leftBeforeSubmit || !withinGrace)
      return NextResponse.json({ error: 'Bài đã nộp' }, { status: 409 });
  }

  const [perEvent, perAttempt] = await Promise.all([
    prisma.quizProctorSnapshot.count({ where: { eventId } }),
    prisma.quizProctorSnapshot.count({ where: { attemptId } }),
  ]);
  if (perEvent >= MAX_PER_EVENT || perAttempt >= MAX_PER_ATTEMPT)
    return NextResponse.json({ skipped: true });

  try {
    await ensureBucket(BUCKET_PROCTORING);

    const serverReceivedAt = new Date();
    const fullName =
      attempt.student.fullName ||
      `${attempt.student.firstName ?? ''} ${attempt.student.lastName ?? ''}`.trim() ||
      'Học sinh';

    const { buffer, width, height } = await processSnapshot(Buffer.from(await file.arrayBuffer()), {
      fullName,
      quizTitle: attempt.quiz.title,
      serverReceivedAt,
    });

    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const objectName = `quiz-proctoring/${attemptId}/${randomBytes(10).toString('hex')}.jpg`;

    await minioClient.putObject(BUCKET_PROCTORING, objectName, buffer, buffer.length, {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, max-age=0, no-store',
    });

    const clientDate =
      typeof capturedAtClient === 'string' && capturedAtClient ? new Date(capturedAtClient) : null;

    await prisma.quizProctorSnapshot.create({
      data: {
        attemptId,
        eventId,
        bucket: BUCKET_PROCTORING,
        objectName,
        mime: 'image/jpeg',
        size: buffer.length,
        sha256,
        width,
        height,
        capturedAtClient: clientDate && !Number.isNaN(clientDate.getTime()) ? clientDate : null,
        serverReceivedAt,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PROCTOR SNAPSHOT UPLOAD]', err);
    return NextResponse.json({ error: 'Lưu ảnh thất bại' }, { status: 500 });
  }
}

type WatermarkInfo = { fullName: string; quizTitle: string; serverReceivedAt: Date };

/** Thu nhỏ, nén JPEG rồi dán dải watermark ở đáy ảnh. */
async function processSnapshot(original: Buffer, info: WatermarkInfo) {
  const { data, info: meta } = await sharp(original)
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer({ resolveWithObject: true });

  const overlay = Buffer.from(watermarkSvg(meta.width, meta.height, info));
  const buffer = await sharp(data)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  return { buffer, width: meta.width, height: meta.height };
}

/** Giờ Việt Nam, có giây — minh chứng rời bài cần chính xác tới giây. */
function vnTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour12: false,
  }).format(date);
}

/** Cùng cách dựng với watermark ảnh bàn giao: SVG dán đè, cỡ chữ theo bề ngang ảnh. */
function watermarkSvg(width: number, height: number, info: WatermarkInfo): string {
  const size = Math.max(11, Math.round(width / 70));
  const pad = Math.round(size * 0.55);
  const barHeight = size + pad * 2;
  const top = Math.max(0, height - barHeight);
  const title = info.quizTitle.length > 60 ? `${info.quizTitle.slice(0, 57)}…` : info.quizTitle;
  const line = `Rời bài lúc ${vnTimestamp(info.serverReceivedAt)} · ${info.fullName} · ${title}`;

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="${top}" width="${width}" height="${barHeight}" fill="#000000" fill-opacity="0.6"/>
  <text x="${pad}" y="${top + pad + size * 0.85}" font-family="sans-serif" font-size="${size}"
        font-weight="bold" fill="#ffffff">${escapeXml(line)}</text>
</svg>`;
}

/** Họ tên và tên quiz do người dùng nhập nên phải thoát trước khi nhúng vào SVG. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
