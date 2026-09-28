import { beforeEach, describe, expect, it } from 'vitest';
import type { Cache } from 'cache-manager';
import { testPrisma } from '../db';
import { createTestCategory, createTestCourse, createTestUser } from '../factories';
import { QuestionsService } from '@/modules/questions/questions.service';
import { CategoryQuestionBankService } from '@/modules/questions/category-question-bank.service';
import { CategoriesService } from '@/modules/categories/categories.service';
import { CategoryBankAccessService } from '@/modules/categories/category-bank-access.service';
import type { Judge0Service } from '@/common/judge0/judge0.service';
import type { AuthUser } from '@/common/auth/auth.types';

/**
 * Xoá trong ngân hàng chung của danh mục: xoá thư mục và xoá nhiều câu một lượt.
 *
 * Trước đây xoá thư mục chỉ gỡ thư mục, câu hỏi rơi hết về "chưa xếp thư mục",
 * còn câu hỏi thì chỉ xoá được từng câu một. Giáo viên dọn một chương vài chục
 * câu phải bấm vài chục lần.
 */

const noopCache = { del: async () => undefined } as unknown as Cache;

function makeServices() {
  const categories = new CategoriesService(testPrisma, noopCache, {
    log: async () => undefined,
  } as never);
  const bank = new CategoryQuestionBankService(
    testPrisma,
    new CategoryBankAccessService(testPrisma, categories)
  );
  const questions = new QuestionsService(testPrisma, {} as Judge0Service, bank);
  return { bank, questions };
}

async function setup() {
  const admin = await createTestUser({ role: 'ADMIN' });
  const teacher = await createTestUser({ role: 'TEACHER' });
  const category = await createTestCategory();
  // Giáo viên soạn được kho của danh mục chứa khoá mình dạy.
  await createTestCourse({ ownerId: teacher.id, categoryId: category.id });
  return {
    category,
    adminUser: { id: admin.id, role: 'ADMIN' } as AuthUser,
    teacherUser: { id: teacher.id, role: 'TEACHER' } as AuthUser,
  };
}

async function taoThuMuc(bankCategoryId: string, createdBy: string) {
  return testPrisma.questionCategory.create({
    data: { bankCategoryId, name: 'Chương 1', position: 0, createdBy },
  });
}

async function taoCau(bankCategoryId: string, createdBy: string, categoryId: string | null) {
  return testPrisma.question.create({
    data: {
      bankCategoryId,
      categoryId,
      type: 'MULTIPLE_CHOICE_SINGLE',
      content: '<p>Hỏi?</p>',
      createdBy,
      options: { create: [{ content: '<p>A</p>', isCorrect: true, position: 0 }] },
    },
  });
}

describe('Xoá thư mục trong ngân hàng chung', () => {
  let bank: CategoryQuestionBankService;

  beforeEach(() => {
    ({ bank } = makeServices());
  });

  it('xoá luôn câu hỏi bên trong, không đẩy chúng về nhóm chưa xếp thư mục', async () => {
    const { category, adminUser } = await setup();
    const folder = await taoThuMuc(category.id, adminUser.id);
    await taoCau(category.id, adminUser.id, folder.id);
    await taoCau(category.id, adminUser.id, folder.id);
    const ngoai = await taoCau(category.id, adminUser.id, null);

    const res = await bank.deleteFolder(adminUser, folder.id);
    expect(res.message).toContain('2 câu hỏi');

    const data = await bank.get(adminUser, category.id);
    expect(data.folders).toHaveLength(0);
    // Chỉ còn đúng câu vốn đã nằm ngoài thư mục.
    expect(data.uncategorized.map((q) => q.id)).toEqual([ngoai.id]);
    expect(await testPrisma.question.count({ where: { deletedAt: { not: null } } })).toBe(2);
  });

  it('giáo viên không xoá được thư mục có câu của người khác, và không xoá dở dang', async () => {
    const { category, adminUser, teacherUser } = await setup();
    const folder = await taoThuMuc(category.id, teacherUser.id);
    await taoCau(category.id, teacherUser.id, folder.id);
    await taoCau(category.id, adminUser.id, folder.id);

    await expect(bank.deleteFolder(teacherUser, folder.id)).rejects.toThrow(/người khác/);

    expect(await testPrisma.questionCategory.count({ where: { id: folder.id } })).toBe(1);
    expect(await testPrisma.question.count({ where: { deletedAt: null } })).toBe(2);
  });

  it('báo số quiz mẫu đang dùng từng câu để màn hình cảnh báo trước khi xoá', async () => {
    const { category, adminUser } = await setup();
    const folder = await taoThuMuc(category.id, adminUser.id);
    const dung = await taoCau(category.id, adminUser.id, folder.id);
    await taoCau(category.id, adminUser.id, folder.id);
    const quiz = await testPrisma.quiz.create({
      data: { bankCategoryId: category.id, title: 'Quiz mẫu', createdBy: adminUser.id },
    });
    await testPrisma.quizQuestion.create({ data: { quizId: quiz.id, questionId: dung.id } });

    const data = await bank.get(adminUser, category.id);
    const dem = Object.fromEntries(data.folders[0]!.questions.map((q) => [q.id, q.quizCount]));
    expect(dem[dung.id]).toBe(1);
    expect(Object.values(dem).filter((n) => n === 0)).toHaveLength(1);
  });
});

describe('Xoá nhiều câu hỏi một lượt', () => {
  let questions: QuestionsService;

  beforeEach(() => {
    ({ questions } = makeServices());
  });

  it('xoá mềm đúng các câu đã chọn', async () => {
    const { category, adminUser } = await setup();
    const a = await taoCau(category.id, adminUser.id, null);
    const b = await taoCau(category.id, adminUser.id, null);
    const giu = await taoCau(category.id, adminUser.id, null);

    const res = await questions.deleteMany(adminUser, [a.id, b.id, a.id]);
    expect(res.deleted).toBe(2);

    const conLai = await testPrisma.question.findMany({ where: { deletedAt: null } });
    expect(conLai.map((q) => q.id)).toEqual([giu.id]);
  });

  it('lẫn một câu của người khác thì giáo viên không xoá được câu nào', async () => {
    const { category, adminUser, teacherUser } = await setup();
    const cuaMinh = await taoCau(category.id, teacherUser.id, null);
    const cuaAdmin = await taoCau(category.id, adminUser.id, null);

    await expect(questions.deleteMany(teacherUser, [cuaMinh.id, cuaAdmin.id])).rejects.toThrow();
    expect(await testPrisma.question.count({ where: { deletedAt: null } })).toBe(2);

    await questions.deleteMany(teacherUser, [cuaMinh.id]);
    expect(await testPrisma.question.count({ where: { deletedAt: null } })).toBe(1);
  });

  it('câu đã bị xoá từ trước thì báo tải lại trang, không xoá gì', async () => {
    const { category, adminUser } = await setup();
    const a = await taoCau(category.id, adminUser.id, null);
    const daXoa = await taoCau(category.id, adminUser.id, null);
    await testPrisma.question.update({ where: { id: daXoa.id }, data: { deletedAt: new Date() } });

    await expect(questions.deleteMany(adminUser, [a.id, daXoa.id])).rejects.toThrow(/Tải lại/);
    expect(await testPrisma.question.count({ where: { id: a.id, deletedAt: null } })).toBe(1);
  });

  it('người ngoài danh mục không xoá được câu của kho', async () => {
    const { category, adminUser } = await setup();
    const q = await taoCau(category.id, adminUser.id, null);
    const nguoiNgoai = await createTestUser({ role: 'TEACHER' });

    await expect(
      questions.deleteMany({ id: nguoiNgoai.id, role: 'TEACHER' } as AuthUser, [q.id])
    ).rejects.toThrow();
    expect(await testPrisma.question.count({ where: { deletedAt: null } })).toBe(1);
  });
});
