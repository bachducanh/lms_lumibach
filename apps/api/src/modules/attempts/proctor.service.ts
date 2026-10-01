import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient, type Prisma, type ProctorEventType } from '@lumibach/db';
import type { AuthUser } from '../../common/auth/auth.types';
import { resolveCourseAccess } from '../../common/auth/course-access';
import { StorageService } from '../../common/storage/storage.service';
import { AttemptsService } from './attempts.service';

/**
 * Loại sự kiện client được phép gửi. AUTO_SUBMITTED cố ý KHÔNG có ở đây: chỉ
 * máy chủ ghi loại đó, lúc chính nó tự nộp bài.
 */
const EVENT_TYPES: readonly ProctorEventType[] = [
  'SESSION_START',
  'TAB_HIDDEN',
  'WINDOW_BLUR',
  'PAGE_LEFT',
  'SHARE_STOPPED',
];

/** Các loại sự kiện tính là một lần rời bài (cộng vào proctorLeaveCount). */
const LEAVE_TYPES = new Set<ProctorEventType>(['TAB_HIDDEN', 'WINDOW_BLUR', 'PAGE_LEFT']);

/**
 * Trần số sự kiện của một lượt làm. Học sinh bình thường không bao giờ chạm tới;
 * chốt này chỉ để một client lỗi (hoặc cố tình) không làm phình bảng vô hạn.
 */
const MAX_EVENTS_PER_ATTEMPT = 1000;

/**
 * Thời gian rời tối đa được ghi cho một lượt. Học sinh đóng máy rồi hôm sau mới
 * mở lại bài thì con số thật vô nghĩa, lại có thể tràn cột Int (tính bằng ms).
 */
const MAX_AWAY_MS = 24 * 60 * 60 * 1000;

/** Chỉ giữ những khoá môi trường đã biết, giá trị nguyên thuỷ, chuỗi ngắn. */
const META_KEYS = new Set([
  'surface',
  'isExtended',
  'screenWidth',
  'screenHeight',
  'screenshots',
  'userAgent',
]);

function sanitizeMeta(raw: unknown): Prisma.InputJsonObject | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!META_KEYS.has(key)) continue;
    if (typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'string') out[key] = value.slice(0, 300);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseClientDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Giám sát rời bài khi làm quiz.
 *
 * Trình duyệt báo mỗi lần học sinh rời trang (chuyển tab, chuyển cửa sổ, bấm
 * sang trang khác) và lúc quay lại. Mọi mốc thời gian nghiệp vụ lấy theo giờ
 * MÁY CHỦ: thời gian rời = lúc nhận "quay lại" trừ lúc nhận "rời", nên học sinh
 * không khai gian được bằng cách chỉnh đồng hồ máy.
 *
 * Quiz có đặt `proctorMaxLeaves` thì rời lần thứ N+1 là máy chủ tự nộp bài ngay
 * trong request ghi sự kiện đó — không giao cho client, vì client bị chỉnh sửa
 * thì chỉ cần bỏ qua lệnh nộp là làm tiếp được.
 *
 * Ảnh chụp màn hình minh chứng KHÔNG đi qua đây — multipart/sharp nằm ở route
 * `apps/web/src/app/api/upload/proctor-snapshot`, ghi thẳng vào QuizProctorSnapshot.
 */
@Injectable()
export class ProctorService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService,
    private readonly attempts: AttemptsService
  ) {}

  /** Lượt làm của CHÍNH học sinh này, thuộc quiz có bật giám sát. */
  private async ownAttempt(user: AuthUser, attemptId: string) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      select: {
        studentId: true,
        status: true,
        quiz: { select: { proctorEnabled: true, proctorMaxLeaves: true } },
      },
    });
    if (!attempt || attempt.studentId !== user.id) throw new NotFoundException('Không tìm thấy.');
    if (!attempt.quiz.proctorEnabled) {
      throw new ForbiddenException('Quiz này không bật giám sát rời bài.');
    }
    return attempt;
  }

  /**
   * Đóng mọi lượt rời còn dở. Lượt rời dở khi trang bài làm bị đóng / tải lại /
   * trình duyệt tắt hẳn: trang cũ không còn để báo "quay lại", nên lần mở bài
   * kế tiếp là mốc quay lại. Đánh dấu `reopened` để giáo viên biết lượt này kết
   * thúc bằng việc mở lại trang, không phải quay về tab cũ.
   */
  private async closeOpenLeaves(attemptId: string, now: Date) {
    const open = await this.prisma.quizProctorEvent.findMany({
      where: { attemptId, durationMs: null, type: { in: [...LEAVE_TYPES] } },
      select: { id: true, occurredAt: true, meta: true },
    });
    if (open.length === 0) return;

    let addedMs = 0;
    const ops: Prisma.PrismaPromise<unknown>[] = open.map((e) => {
      const ms = Math.min(MAX_AWAY_MS, Math.max(0, now.getTime() - e.occurredAt.getTime()));
      addedMs += ms;
      const meta = { ...((e.meta as Prisma.JsonObject | null) ?? {}), reopened: true };
      return this.prisma.quizProctorEvent.updateMany({
        where: { id: e.id, durationMs: null },
        data: { durationMs: ms, meta },
      });
    });
    ops.push(
      this.prisma.quizAttempt.update({
        where: { id: attemptId },
        data: { proctorAwayMs: { increment: addedMs } },
      })
    );
    await this.prisma.$transaction(ops);
  }

  // ── Học sinh: ghi sự kiện ─────────────────────────────────────

  async recordEvent(
    user: AuthUser,
    attemptId: string,
    body: { type?: string; clientAt?: string | null; meta?: unknown }
  ): Promise<{ eventId: string | null; leaveCount?: number; autoSubmitted?: boolean }> {
    const type = body.type as ProctorEventType;
    if (!EVENT_TYPES.includes(type)) throw new BadRequestException('Loại sự kiện không hợp lệ.');

    const attempt = await this.ownAttempt(user, attemptId);
    // Bài đã nộp thì trang kết quả không còn gì để giám sát. Không ném lỗi: trang
    // làm bài báo "rời trang" đúng lúc chuyển sang trang kết quả là chuyện bình thường.
    if (attempt.status !== 'IN_PROGRESS') return { eventId: null };

    const count = await this.prisma.quizProctorEvent.count({ where: { attemptId } });
    if (count >= MAX_EVENTS_PER_ATTEMPT) return { eventId: null };

    const now = new Date();
    if (type === 'SESSION_START') await this.closeOpenLeaves(attemptId, now);

    const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.quizProctorEvent.create({
        data: {
          attemptId,
          type,
          occurredAt: now,
          clientAt: parseClientDate(body.clientAt),
          meta: sanitizeMeta(body.meta),
        },
        select: { id: true },
      });
      if (!LEAVE_TYPES.has(type)) return { eventId: event.id };

      const { proctorLeaveCount } = await tx.quizAttempt.update({
        where: { id: attemptId },
        data: { proctorLeaveCount: { increment: 1 } },
        select: { proctorLeaveCount: true },
      });
      return { eventId: event.id, leaveCount: proctorLeaveCount };
    });

    const max = attempt.quiz.proctorMaxLeaves;
    if (result.leaveCount !== undefined && max !== null && result.leaveCount > max) {
      const autoSubmitted = await this.autoSubmit(user, attemptId, result.leaveCount, max);
      return { ...result, autoSubmitted };
    }
    return result;
  }

  /**
   * Nộp bài thay học sinh khi rời quá số lần cho phép, qua đúng luồng chấm của
   * AttemptsService.submit. Trả true nếu sau lệnh này bài đã ở trạng thái nộp.
   */
  private async autoSubmit(
    user: AuthUser,
    attemptId: string,
    leaveCount: number,
    maxLeaves: number
  ): Promise<boolean> {
    try {
      await this.attempts.submit(user, attemptId);
    } catch (err) {
      // Bài vừa được nộp bằng đường khác (hết giờ, học sinh bấm nộp) trong lúc
      // này: kết quả vẫn là đã nộp, chỉ là không phải do giám sát nộp.
      const current = await this.prisma.quizAttempt.findUnique({
        where: { id: attemptId },
        select: { status: true },
      });
      if (current && current.status !== 'IN_PROGRESS') return true;
      throw err;
    }

    await this.prisma.quizProctorEvent.create({
      data: { attemptId, type: 'AUTO_SUBMITTED', meta: { leaveCount, maxLeaves } },
    });
    return true;
  }

  /**
   * Học sinh quay lại (hoặc chia sẻ màn hình lại sau SHARE_STOPPED). Thời gian
   * tính bằng giờ máy chủ. Gọi lặp lại vô hại: chỉ dòng chưa có durationMs mới
   * được ghi. Cho phép cả khi bài đã nộp — hết giờ tự nộp trong lúc học sinh
   * đang ở ngoài thì vẫn cần biết em ra ngoài bao lâu.
   */
  async endEvent(
    user: AuthUser,
    attemptId: string,
    eventId: string,
    body: { hidden?: boolean; captureFailures?: number }
  ) {
    await this.ownAttempt(user, attemptId);

    const event = await this.prisma.quizProctorEvent.findUnique({
      where: { id: eventId },
      select: { attemptId: true, type: true, occurredAt: true, durationMs: true, meta: true },
    });
    if (!event || event.attemptId !== attemptId) throw new NotFoundException('Không tìm thấy.');
    if (event.durationMs !== null) return { durationMs: event.durationMs };
    // Chỉ lượt rời và lượt ngừng chia sẻ màn hình mới có "độ dài".
    if (!LEAVE_TYPES.has(event.type) && event.type !== 'SHARE_STOPPED') {
      return { durationMs: null };
    }

    const ms = Math.min(MAX_AWAY_MS, Math.max(0, Date.now() - event.occurredAt.getTime()));
    // Rời cửa sổ rồi mới chuyển tab: tab bị ẩn là thông tin nặng hơn, ghi theo nó.
    const type: ProctorEventType =
      event.type === 'WINDOW_BLUR' && body.hidden === true ? 'TAB_HIDDEN' : event.type;

    // Số lần đến giờ chụp mà trình duyệt không cho lấy hình (Safari/Firefox có thể
    // ngừng cập nhật hình khi tab bị ẩn). Ghi lại để giáo viên biết vì sao lượt rời
    // không có ảnh, thay vì chỉ thấy "0 ảnh".
    const failures = Number.isInteger(body.captureFailures)
      ? Math.min(20, Math.max(0, body.captureFailures as number))
      : 0;
    const meta =
      failures > 0
        ? { ...((event.meta as Prisma.JsonObject | null) ?? {}), captureFailures: failures }
        : undefined;

    const updated = await this.prisma.quizProctorEvent.updateMany({
      where: { id: eventId, durationMs: null },
      data: { durationMs: ms, type, ...(meta ? { meta } : {}) },
    });
    if (updated.count > 0 && LEAVE_TYPES.has(event.type)) {
      await this.prisma.quizAttempt.update({
        where: { id: attemptId },
        data: { proctorAwayMs: { increment: ms } },
      });
    }
    return { durationMs: ms };
  }

  // ── Giáo viên: xem báo cáo ────────────────────────────────────

  /** Người chấm bài của lớp (ADMIN, chủ khoá, đồng giảng dạy, trợ giảng). */
  private async assertCanGrade(user: AuthUser, courseId: string | null) {
    if (!courseId) throw new NotFoundException('Không tìm thấy.');
    const access = await resolveCourseAccess(this.prisma, user, courseId);
    if (!access.canGrade) throw new ForbiddenException('Không có quyền xem giám sát bài làm này.');
  }

  async report(user: AuthUser, attemptId: string) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        proctorLeaveCount: true,
        proctorAwayMs: true,
        quiz: { select: { courseId: true, proctorMaxLeaves: true } },
        proctorEvents: {
          orderBy: { occurredAt: 'asc' },
          select: {
            id: true,
            type: true,
            occurredAt: true,
            durationMs: true,
            meta: true,
            snapshots: {
              orderBy: { serverReceivedAt: 'asc' },
              select: { id: true, width: true, height: true, serverReceivedAt: true },
            },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Không tìm thấy.');
    await this.assertCanGrade(user, attempt.quiz.courseId);

    return {
      attemptId: attempt.id,
      leaveCount: attempt.proctorLeaveCount,
      awayMs: attempt.proctorAwayMs,
      maxLeaves: attempt.quiz.proctorMaxLeaves,
      events: attempt.proctorEvents.map((e) => ({
        id: e.id,
        type: e.type,
        occurredAt: e.occurredAt,
        durationMs: e.durationMs,
        meta: (e.meta as Record<string, unknown> | null) ?? null,
        snapshots: e.snapshots.map((p) => ({
          id: p.id,
          url: `/api/v1/attempts/proctor-snapshots/${p.id}/file`,
          width: p.width,
          height: p.height,
          serverReceivedAt: p.serverReceivedAt,
        })),
      })),
    };
  }

  async snapshotFile(user: AuthUser, snapshotId: string) {
    const snapshot = await this.prisma.quizProctorSnapshot.findUnique({
      where: { id: snapshotId },
      select: {
        id: true,
        bucket: true,
        objectName: true,
        mime: true,
        size: true,
        attempt: { select: { quiz: { select: { courseId: true } } } },
      },
    });
    if (!snapshot) throw new NotFoundException('Không tìm thấy ảnh.');
    await this.assertCanGrade(user, snapshot.attempt.quiz.courseId);

    const stream = await this.storage.getObject(snapshot.bucket, snapshot.objectName);
    return { stream, mime: snapshot.mime, size: snapshot.size, id: snapshot.id };
  }
}
