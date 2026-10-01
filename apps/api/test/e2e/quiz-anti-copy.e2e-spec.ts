import { describe, expect, it } from 'vitest';
import type { Cache } from 'cache-manager';
import { testPrisma } from '../db';
import { createTestCategory, createTestCourse, createTestUser } from '../factories';
import { QuizzesService } from '@/modules/quizzes/quizzes.service';
import { AttemptsService } from '@/modules/attempts/attempts.service';
import { StorageService } from '@/common/storage/storage.service';
import type { Judge0Service } from '@/common/judge0/judge0.service';
import type { AuthUser } from '@/common/auth/auth.types';

/**
 * Chống sao chép khi làm quiz: cài đặt lưu đúng, chỉ có ở quiz của lớp, và lượt
 * làm trả đủ thông tin để trang làm bài in chìm tên học sinh.
 */

const noopCache = { del: async () => undefined } as unknown as Cache;
const noopJudge0 = {} as unknown as Judge0Service;
const asUser = (u: { id: string; role: string }) => ({ id: u.id, role: u.role }) as AuthUser;

describe('Chống sao chép khi làm quiz', () => {
  it('lưu cài đặt khi tạo và sửa quiz; mặc định in chìm tên', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const course = await createTestCourse({ ownerId: admin.id, status: 'PUBLISHED' });
    const quizzes = new QuizzesService(testPrisma, noopCache);

    const { quizId } = await quizzes.create(asUser(admin), {
      courseId: course.id,
      title: 'Kiểm tra trên điện thoại',
      antiCopyEnabled: true,
    });
    let quiz = await testPrisma.quiz.findUniqueOrThrow({ where: { id: quizId } });
    expect(quiz).toMatchObject({
      antiCopyEnabled: true,
      antiCopyBlockPaste: false,
      antiCopyWatermark: true,
    });

    await quizzes.update(asUser(admin), quizId, {
      title: 'Kiểm tra trên điện thoại',
      antiCopyBlockPaste: true,
      antiCopyWatermark: false,
    });
    quiz = await testPrisma.quiz.findUniqueOrThrow({ where: { id: quizId } });
    expect(quiz).toMatchObject({
      antiCopyEnabled: true,
      antiCopyBlockPaste: true,
      antiCopyWatermark: false,
    });
  });

  it('quiz mẫu trong kho không bật được chống sao chép', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const category = await createTestCategory();
    const template = await testPrisma.quiz.create({
      data: { bankCategoryId: category.id, title: 'Mẫu', createdBy: admin.id },
    });

    await new QuizzesService(testPrisma, noopCache).update(asUser(admin), template.id, {
      title: 'Mẫu',
      antiCopyEnabled: true,
    });
    const after = await testPrisma.quiz.findUniqueOrThrow({ where: { id: template.id } });
    expect(after.antiCopyEnabled).toBe(false);
  });

  it('lượt làm trả cờ chống sao chép và tên học sinh để in chìm', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const student = await createTestUser({ role: 'STUDENT', fullName: 'Trần Thị B' });
    const course = await createTestCourse({ ownerId: admin.id, status: 'PUBLISHED' });
    const quiz = await testPrisma.quiz.create({
      data: {
        courseId: course.id,
        title: 'Có chống sao chép',
        status: 'PUBLISHED',
        antiCopyEnabled: true,
        antiCopyBlockPaste: true,
        createdBy: admin.id,
      },
    });
    const attempt = await testPrisma.quizAttempt.create({
      data: { quizId: quiz.id, studentId: student.id },
    });

    const data = await new AttemptsService(testPrisma, noopJudge0, new StorageService()).getById(
      asUser(student),
      attempt.id
    );
    expect(data.quiz).toMatchObject({
      antiCopyEnabled: true,
      antiCopyBlockPaste: true,
      antiCopyWatermark: true,
    });
    expect(data.student).toEqual({
      fullName: 'Trần Thị B',
      username: null,
      email: student.email,
    });
  });
});
