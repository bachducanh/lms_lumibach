import { beforeEach, describe, expect, it } from 'vitest';
import type { Cache } from 'cache-manager';
import { testPrisma } from '../db';
import { createTestCourse, createTestUser } from '../factories';
import { PracticeTestsService } from '@/modules/practice-tests/practice-tests.service';
import type { AuthUser } from '@/common/auth/auth.types';

/**
 * `create()` xưa nay vẫn chặn pdfUrl trỏ ra ngoài storage, nhưng `update()` thì
 * ghi thẳng giá trị client gửi lên — người quản lý khoá học có thể PATCH pdfUrl
 * thành `javascript:` hoặc link ngoài, đi vòng qua hàng rào của create().
 * Các test dưới đây khoá cả hai đường vào.
 */

const noopCache = { del: async () => undefined } as unknown as Cache;

const QUESTIONS = [{ type: 'SHORT_ANSWER' as const, points: 1, acceptedAnswers: ['42'] }];

describe('Đề luyện tập — hàng rào file storage', () => {
  let service: PracticeTestsService;

  beforeEach(() => {
    service = new PracticeTestsService(testPrisma, noopCache);
  });

  async function setup() {
    const teacher = await createTestUser({ role: 'ADMIN' });
    const course = await createTestCourse({ ownerId: teacher.id, status: 'PUBLISHED' });
    return { course, teacherUser: { id: teacher.id, role: 'ADMIN' } as AuthUser };
  }

  async function createValid() {
    const { course, teacherUser } = await setup();
    const { practiceTestId } = await service.create(teacherUser, {
      courseId: course.id,
      title: 'Đề ôn tập',
      pdfUrl: '/storage/lumibach-files/practice-tests/de.pdf',
      pdfName: 'de.pdf',
      questions: QUESTIONS,
    });
    return { practiceTestId, teacherUser, course };
  }

  it.each([
    ['link ngoài', 'https://evil.com/x.pdf'],
    ['giao thức javascript', 'javascript:alert(1)'],
    ['host ăn theo tiền tố', 'https://media.lumibach.com.evil.com/storage/lumibach-files/x.pdf'],
    ['đường dẫn không thuộc storage', '/uploads/x.pdf'],
  ])('create từ chối pdfUrl là %s', async (_label, pdfUrl) => {
    const { course, teacherUser } = await setup();
    await expect(
      service.create(teacherUser, {
        courseId: course.id,
        title: 'Đề ôn tập',
        pdfUrl,
        pdfName: 'x.pdf',
        questions: QUESTIONS,
      })
    ).rejects.toThrow('File PDF không hợp lệ.');
  });

  it('update từ chối ghi đè pdfUrl bằng link ngoài', async () => {
    const { practiceTestId, teacherUser } = await createValid();

    await expect(
      service.update(teacherUser, practiceTestId, { pdfUrl: 'https://evil.com/x.pdf' })
    ).rejects.toThrow('File PDF không hợp lệ.');

    // Giá trị cũ phải còn nguyên, không bị ghi đè một phần.
    const row = await testPrisma.practiceTest.findUnique({
      where: { id: practiceTestId },
      select: { pdfUrl: true },
    });
    expect(row?.pdfUrl).toBe('/storage/lumibach-files/practice-tests/de.pdf');
  });

  it('update vẫn nhận pdfUrl hợp lệ trong storage', async () => {
    const { practiceTestId, teacherUser } = await createValid();

    await service.update(teacherUser, practiceTestId, {
      pdfUrl: '/storage/lumibach-files/practice-tests/de-moi.pdf',
    });

    const row = await testPrisma.practiceTest.findUnique({
      where: { id: practiceTestId },
      select: { pdfUrl: true },
    });
    expect(row?.pdfUrl).toBe('/storage/lumibach-files/practice-tests/de-moi.pdf');
  });

  it('update không đụng tới pdfUrl khi request không gửi trường này', async () => {
    const { practiceTestId, teacherUser } = await createValid();

    await service.update(teacherUser, practiceTestId, { title: 'Tên mới' });

    const row = await testPrisma.practiceTest.findUnique({
      where: { id: practiceTestId },
      select: { pdfUrl: true, title: true },
    });
    expect(row?.title).toBe('Tên mới');
    expect(row?.pdfUrl).toBe('/storage/lumibach-files/practice-tests/de.pdf');
  });
});
