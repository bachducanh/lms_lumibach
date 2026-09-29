import { beforeEach, describe, expect, it } from 'vitest';
import { testPrisma } from '../db';
import { createTestCourse, createTestUser } from '../factories';
import { ProctorService } from '@/modules/attempts/proctor.service';
import { StorageService } from '@/common/storage/storage.service';
import { AttemptsService } from '@/modules/attempts/attempts.service';
import type { Judge0Service } from '@/common/judge0/judge0.service';
import type { AuthUser } from '@/common/auth/auth.types';

/**
 * Giám sát rời bài khi làm quiz: đếm số lần rời, thời gian rời theo giờ máy chủ,
 * và chỉ người chấm của đúng lớp mới xem được nhật ký.
 */

const asUser = (u: { id: string; role: string }) => ({ id: u.id, role: u.role }) as AuthUser;

const noopJudge0 = {
  runCode: async () => {
    throw new Error('Judge0 không được gọi trong test này.');
  },
} as unknown as Judge0Service;

async function setup(opts: { proctorEnabled?: boolean; proctorMaxLeaves?: number | null } = {}) {
  const teacher = await createTestUser({ role: 'TEACHER' });
  const student = await createTestUser({ role: 'STUDENT' });
  const course = await createTestCourse({ ownerId: teacher.id, status: 'PUBLISHED' });
  const quiz = await testPrisma.quiz.create({
    data: {
      courseId: course.id,
      title: 'Kiểm tra 15 phút',
      status: 'PUBLISHED',
      proctorEnabled: opts.proctorEnabled ?? true,
      proctorMaxLeaves: opts.proctorMaxLeaves ?? null,
      createdBy: teacher.id,
    },
  });
  const attempt = await testPrisma.quizAttempt.create({
    data: { quizId: quiz.id, studentId: student.id },
  });
  return { teacher, student, course, quiz, attempt };
}

/** Lùi mốc "rời" về quá khứ để thời gian rời đo được là xác định. */
async function backdate(eventId: string, ms: number) {
  await testPrisma.quizProctorEvent.update({
    where: { id: eventId },
    data: { occurredAt: new Date(Date.now() - ms) },
  });
}

describe('Giám sát rời bài', () => {
  let service: ProctorService;

  beforeEach(() => {
    const storage = new StorageService();
    service = new ProctorService(
      testPrisma,
      storage,
      new AttemptsService(testPrisma, noopJudge0, storage)
    );
  });

  it('rời quá số lần cho phép thì máy chủ tự nộp bài và ghi vào nhật ký', async () => {
    const { student, attempt } = await setup({ proctorMaxLeaves: 2 });
    const me = asUser(student);

    // Được rời đúng 2 lần mà bài vẫn mở.
    for (let i = 0; i < 2; i++) {
      const r = await service.recordEvent(me, attempt.id, { type: 'TAB_HIDDEN' });
      expect(r.autoSubmitted).toBeUndefined();
    }
    let row = await testPrisma.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).toBe('IN_PROGRESS');

    // Lần thứ 3 vượt giới hạn → nộp ngay.
    const third = await service.recordEvent(me, attempt.id, { type: 'WINDOW_BLUR' });
    expect(third.autoSubmitted).toBe(true);
    expect(third.leaveCount).toBe(3);

    row = await testPrisma.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).not.toBe('IN_PROGRESS');
    expect(row.submittedAt).not.toBeNull();

    const auto = await testPrisma.quizProctorEvent.findFirstOrThrow({
      where: { attemptId: attempt.id, type: 'AUTO_SUBMITTED' },
    });
    expect(auto.meta).toEqual({ leaveCount: 3, maxLeaves: 2 });

    // Bài đã nộp: rời tiếp không tính thêm, không nộp lại.
    const after = await service.recordEvent(me, attempt.id, { type: 'TAB_HIDDEN' });
    expect(after.eventId).toBeNull();
  });

  it('giới hạn 0: rời lần đầu là nộp; không đặt giới hạn thì không bao giờ tự nộp', async () => {
    const strict = await setup({ proctorMaxLeaves: 0 });
    const first = await service.recordEvent(asUser(strict.student), strict.attempt.id, {
      type: 'PAGE_LEFT',
    });
    expect(first.autoSubmitted).toBe(true);

    const open = await setup({ proctorMaxLeaves: null });
    for (let i = 0; i < 5; i++) {
      await service.recordEvent(asUser(open.student), open.attempt.id, { type: 'TAB_HIDDEN' });
    }
    const row = await testPrisma.quizAttempt.findUniqueOrThrow({ where: { id: open.attempt.id } });
    expect(row.status).toBe('IN_PROGRESS');
    expect(row.proctorLeaveCount).toBe(5);
  });

  it('vào bài và ngừng chia sẻ màn hình không tính vào giới hạn', async () => {
    const { student, attempt } = await setup({ proctorMaxLeaves: 0 });
    const me = asUser(student);
    await service.recordEvent(me, attempt.id, { type: 'SESSION_START' });
    await service.recordEvent(me, attempt.id, { type: 'SHARE_STOPPED' });
    const row = await testPrisma.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).toBe('IN_PROGRESS');
  });

  it('client không tự ghi được sự kiện AUTO_SUBMITTED', async () => {
    const { student, attempt } = await setup();
    await expect(
      service.recordEvent(asUser(student), attempt.id, { type: 'AUTO_SUBMITTED' })
    ).rejects.toThrow('Loại sự kiện không hợp lệ');
  });

  it('mỗi lượt rời cộng một lần, quay lại thì ghi thời gian rời theo giờ máy chủ', async () => {
    const { student, attempt } = await setup();
    const me = asUser(student);

    const first = await service.recordEvent(me, attempt.id, { type: 'TAB_HIDDEN' });
    expect(first.eventId).toBeTruthy();
    expect(first.leaveCount).toBe(1);

    await backdate(first.eventId!, 30_000);
    const ended = await service.endEvent(me, attempt.id, first.eventId!, {});
    expect(ended.durationMs).toBeGreaterThanOrEqual(30_000);
    expect(ended.durationMs).toBeLessThan(35_000);

    // Gọi lại lần nữa không cộng dồn thêm thời gian.
    await service.endEvent(me, attempt.id, first.eventId!, {});

    const second = await service.recordEvent(me, attempt.id, { type: 'WINDOW_BLUR' });
    expect(second.leaveCount).toBe(2);

    const row = await testPrisma.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.proctorLeaveCount).toBe(2);
    expect(row.proctorAwayMs).toBe(ended.durationMs);
  });

  it('rời cửa sổ rồi chuyển tab thì lượt đó được ghi là chuyển tab', async () => {
    const { student, attempt } = await setup();
    const me = asUser(student);

    const { eventId } = await service.recordEvent(me, attempt.id, { type: 'WINDOW_BLUR' });
    await service.endEvent(me, attempt.id, eventId!, { hidden: true });

    const event = await testPrisma.quizProctorEvent.findUniqueOrThrow({ where: { id: eventId! } });
    expect(event.type).toBe('TAB_HIDDEN');
  });

  it('mở lại trang bài làm thì khép các lượt rời còn dở và đánh dấu reopened', async () => {
    const { student, attempt } = await setup();
    const me = asUser(student);

    // Trang bị đóng: có "rời" nhưng không bao giờ có "quay lại".
    const { eventId } = await service.recordEvent(me, attempt.id, { type: 'TAB_HIDDEN' });
    await backdate(eventId!, 120_000);

    const session = await service.recordEvent(me, attempt.id, { type: 'SESSION_START' });
    expect(session.leaveCount).toBeUndefined();

    const closed = await testPrisma.quizProctorEvent.findUniqueOrThrow({
      where: { id: eventId! },
    });
    expect(closed.durationMs).toBeGreaterThanOrEqual(120_000);
    expect((closed.meta as Record<string, unknown>).reopened).toBe(true);

    const row = await testPrisma.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.proctorLeaveCount).toBe(1);
    expect(row.proctorAwayMs).toBe(closed.durationMs);
  });

  it('chỉ giữ thông tin môi trường đã biết trong meta', async () => {
    const { student, attempt } = await setup();
    const { eventId } = await service.recordEvent(asUser(student), attempt.id, {
      type: 'SESSION_START',
      meta: { isExtended: true, surface: 'monitor', evil: { nested: 1 }, screenWidth: 'x' },
    });
    const event = await testPrisma.quizProctorEvent.findUniqueOrThrow({ where: { id: eventId! } });
    expect(event.meta).toEqual({ isExtended: true, surface: 'monitor', screenWidth: 'x' });
  });

  it('từ chối loại sự kiện lạ, lượt làm của người khác và quiz không bật giám sát', async () => {
    const { student, attempt } = await setup();
    await expect(
      service.recordEvent(asUser(student), attempt.id, { type: 'HACKED' })
    ).rejects.toThrow('Loại sự kiện không hợp lệ');

    const other = await createTestUser({ role: 'STUDENT' });
    await expect(
      service.recordEvent(asUser(other), attempt.id, { type: 'TAB_HIDDEN' })
    ).rejects.toThrow('Không tìm thấy');

    const off = await setup({ proctorEnabled: false });
    await expect(
      service.recordEvent(asUser(off.student), off.attempt.id, { type: 'TAB_HIDDEN' })
    ).rejects.toThrow('không bật giám sát');
  });

  it('bài đã nộp thì bỏ qua sự kiện mới, không tính thêm lần rời', async () => {
    const { student, attempt } = await setup();
    await testPrisma.quizAttempt.update({
      where: { id: attempt.id },
      data: { status: 'GRADED', submittedAt: new Date() },
    });

    const result = await service.recordEvent(asUser(student), attempt.id, { type: 'PAGE_LEFT' });
    expect(result.eventId).toBeNull();
    const row = await testPrisma.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.proctorLeaveCount).toBe(0);
  });

  it('người chấm của lớp xem được nhật ký, học sinh và trợ giảng lớp khác thì không', async () => {
    const { teacher, student, attempt } = await setup();
    await service.recordEvent(asUser(student), attempt.id, { type: 'SESSION_START' });
    await service.recordEvent(asUser(student), attempt.id, { type: 'TAB_HIDDEN' });

    const report = await service.report(asUser(teacher), attempt.id);
    expect(report.leaveCount).toBe(1);
    expect(report.events.map((e) => e.type)).toEqual(['SESSION_START', 'TAB_HIDDEN']);

    // Trợ giảng được phân vào lớp → xem được.
    const ta = await createTestUser({ role: 'TA' });
    const { course } = await testPrisma.quizAttempt
      .findUniqueOrThrow({
        where: { id: attempt.id },
        select: { quiz: { select: { course: true } } },
      })
      .then((r) => ({ course: r.quiz.course! }));
    await testPrisma.teachingAssistant.create({ data: { userId: ta.id, courseId: course.id } });
    await expect(service.report(asUser(ta), attempt.id)).resolves.toBeTruthy();

    // Trợ giảng của lớp khác, và chính học sinh → bị chặn.
    const otherTa = await createTestUser({ role: 'TA' });
    await expect(service.report(asUser(otherTa), attempt.id)).rejects.toThrow('Không có quyền');
    await expect(service.report(asUser(student), attempt.id)).rejects.toThrow('Không có quyền');
  });
});
