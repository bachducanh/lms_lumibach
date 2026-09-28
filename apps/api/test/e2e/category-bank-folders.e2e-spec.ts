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
 * Thư mục lồng nhau trong ngân hàng chung, và chuyển câu hỏi giữa các thư mục.
 *
 * Giáo viên dựng cây Chương → Bài → Dạng bài, kéo câu hỏi qua lại giữa các nhánh
 * và kéo cả thư mục vào nhau để sắp lại kho cũ vốn chỉ có một cấp.
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
  const khac = await createTestCategory();
  await createTestCourse({ ownerId: teacher.id, categoryId: category.id });
  return {
    category,
    khac,
    adminUser: { id: admin.id, role: 'ADMIN' } as AuthUser,
    teacherUser: { id: teacher.id, role: 'TEACHER' } as AuthUser,
  };
}

async function taoCau(bankCategoryId: string, createdBy: string, categoryId: string | null) {
  return testPrisma.question.create({
    data: {
      bankCategoryId,
      categoryId,
      type: 'MULTIPLE_CHOICE_SINGLE',
      content: '<p>Hỏi?</p>',
      createdBy,
    },
  });
}

describe('Thư mục con trong ngân hàng chung', () => {
  let bank: CategoryQuestionBankService;

  beforeEach(() => {
    ({ bank } = makeServices());
  });

  it('tạo được thư mục con nhiều cấp, trả về phẳng kèm parentId', async () => {
    const { category, adminUser } = await setup();
    const chuong = await bank.createFolder(adminUser, category.id, { name: 'Chương 1' });
    const bai = await bank.createFolder(adminUser, category.id, {
      name: 'Bài 1',
      parentId: chuong.id,
    });
    const dang = await bank.createFolder(adminUser, category.id, {
      name: 'Dạng 1',
      parentId: bai.id,
    });

    const data = await bank.get(adminUser, category.id);
    const cha = Object.fromEntries(data.folders.map((f) => [f.id, f.parentId]));
    expect(cha).toEqual({ [chuong.id]: null, [bai.id]: chuong.id, [dang.id]: bai.id });
  });

  it('không nhận thư mục cha của kho khác', async () => {
    const { category, khac, adminUser } = await setup();
    const cuaKhoKhac = await bank.createFolder(adminUser, khac.id, { name: 'Ngoài' });
    await expect(
      bank.createFolder(adminUser, category.id, { name: 'Con', parentId: cuaKhoKhac.id })
    ).rejects.toThrow(/thư mục cha/);
  });

  it('chuyển thư mục vào thư mục khác và ra cấp ngoài cùng', async () => {
    const { category, adminUser } = await setup();
    const a = await bank.createFolder(adminUser, category.id, { name: 'A' });
    const b = await bank.createFolder(adminUser, category.id, { name: 'B' });

    await bank.moveFolder(adminUser, b.id, { parentId: a.id });
    expect((await testPrisma.questionCategory.findUnique({ where: { id: b.id } }))!.parentId).toBe(
      a.id
    );

    await bank.moveFolder(adminUser, b.id, { parentId: null });
    expect(
      (await testPrisma.questionCategory.findUnique({ where: { id: b.id } }))!.parentId
    ).toBeNull();
  });

  it('chặn chuyển thư mục vào chính nó hay vào nhánh con của nó', async () => {
    const { category, adminUser } = await setup();
    const a = await bank.createFolder(adminUser, category.id, { name: 'A' });
    const b = await bank.createFolder(adminUser, category.id, { name: 'B', parentId: a.id });
    const c = await bank.createFolder(adminUser, category.id, { name: 'C', parentId: b.id });

    await expect(bank.moveFolder(adminUser, a.id, { parentId: a.id })).rejects.toThrow(/chính nó/);
    await expect(bank.moveFolder(adminUser, a.id, { parentId: c.id })).rejects.toThrow(
      /thư mục con/
    );
    // Cây vẫn nguyên.
    expect(
      (await testPrisma.questionCategory.findUnique({ where: { id: a.id } }))!.parentId
    ).toBeNull();
  });

  it('xoá thư mục cha thì xoá cả nhánh: thư mục con và câu hỏi ở mọi cấp', async () => {
    const { category, adminUser } = await setup();
    const a = await bank.createFolder(adminUser, category.id, { name: 'A' });
    const b = await bank.createFolder(adminUser, category.id, { name: 'B', parentId: a.id });
    const c = await bank.createFolder(adminUser, category.id, { name: 'C', parentId: b.id });
    const giu = await bank.createFolder(adminUser, category.id, { name: 'Giữ' });
    await taoCau(category.id, adminUser.id, a.id);
    await taoCau(category.id, adminUser.id, c.id);
    const cauGiu = await taoCau(category.id, adminUser.id, giu.id);

    const res = await bank.deleteFolder(adminUser, a.id);
    expect(res.message).toContain('2 thư mục con');
    expect(res.message).toContain('2 câu hỏi');

    const data = await bank.get(adminUser, category.id);
    expect(data.folders.map((f) => f.id)).toEqual([giu.id]);
    expect(data.uncategorized).toHaveLength(0);
    const conLai = await testPrisma.question.findMany({ where: { deletedAt: null } });
    expect(conLai.map((q) => q.id)).toEqual([cauGiu.id]);
  });

  it('giáo viên không xoá được nhánh có thư mục con của người khác', async () => {
    const { category, adminUser, teacherUser } = await setup();
    const cuaGv = await bank.createFolder(teacherUser, category.id, { name: 'Của GV' });
    await bank.createFolder(adminUser, category.id, { name: 'Của admin', parentId: cuaGv.id });

    await expect(bank.deleteFolder(teacherUser, cuaGv.id)).rejects.toThrow(/thư mục con/);
    expect(await testPrisma.questionCategory.count()).toBe(2);
  });
});

describe('Chuyển câu hỏi giữa các thư mục', () => {
  let bank: CategoryQuestionBankService;
  let questions: QuestionsService;

  beforeEach(() => {
    ({ bank, questions } = makeServices());
  });

  it('chuyển vào thư mục con, rồi về nhóm chưa xếp thư mục', async () => {
    const { category, adminUser } = await setup();
    const a = await bank.createFolder(adminUser, category.id, { name: 'A' });
    const b = await bank.createFolder(adminUser, category.id, { name: 'B', parentId: a.id });
    const q1 = await taoCau(category.id, adminUser.id, a.id);
    const q2 = await taoCau(category.id, adminUser.id, null);

    await questions.moveMany(adminUser, [q1.id, q2.id], b.id);
    const trongB = await testPrisma.question.findMany({ where: { categoryId: b.id } });
    expect(trongB.map((q) => q.id).sort()).toEqual([q1.id, q2.id].sort());

    const res = await questions.moveMany(adminUser, [q1.id], null);
    expect(res.message).toContain('chưa xếp thư mục');
    expect((await testPrisma.question.findUnique({ where: { id: q1.id } }))!.categoryId).toBeNull();
  });

  it('không chuyển sang thư mục của kho khác', async () => {
    const { category, khac, adminUser } = await setup();
    const q = await taoCau(category.id, adminUser.id, null);
    const ngoai = await bank.createFolder(adminUser, khac.id, { name: 'Ngoài' });

    await expect(questions.moveMany(adminUser, [q.id], ngoai.id)).rejects.toThrow(/thư mục đích/);
    expect((await testPrisma.question.findUnique({ where: { id: q.id } }))!.categoryId).toBeNull();
  });

  it('không chuyển một lượt câu của hai kho khác nhau', async () => {
    const { category, khac, adminUser } = await setup();
    const q1 = await taoCau(category.id, adminUser.id, null);
    const q2 = await taoCau(khac.id, adminUser.id, null);
    await expect(questions.moveMany(adminUser, [q1.id, q2.id], null)).rejects.toThrow(/nhiều kho/);
  });

  it('giáo viên không chuyển được câu của người khác, lẫn một câu là không chuyển câu nào', async () => {
    const { category, adminUser, teacherUser } = await setup();
    const a = await bank.createFolder(adminUser, category.id, { name: 'A' });
    const cuaMinh = await taoCau(category.id, teacherUser.id, null);
    const cuaAdmin = await taoCau(category.id, adminUser.id, null);

    await expect(
      questions.moveMany(teacherUser, [cuaMinh.id, cuaAdmin.id], a.id)
    ).rejects.toThrow();
    expect(await testPrisma.question.count({ where: { categoryId: a.id } })).toBe(0);

    await questions.moveMany(teacherUser, [cuaMinh.id], a.id);
    expect(await testPrisma.question.count({ where: { categoryId: a.id } })).toBe(1);
  });
});

describe('Nhập Word vào thư mục con', () => {
  let bank: CategoryQuestionBankService;
  let questions: QuestionsService;

  beforeEach(() => {
    ({ bank, questions } = makeServices());
  });

  const cau = (folderId: string | null, folder: string | null = null) => ({
    type: 'ESSAY',
    content: '<p>Đề</p>',
    folder,
    folderId,
  });

  it('vào đúng thư mục đã chọn dù có thư mục khác trùng tên', async () => {
    const { category, adminUser } = await setup();
    const c1 = await bank.createFolder(adminUser, category.id, { name: 'Chương 1' });
    const c2 = await bank.createFolder(adminUser, category.id, { name: 'Chương 2' });
    await bank.createFolder(adminUser, category.id, { name: 'Bài tập', parentId: c1.id });
    const baiTap2 = await bank.createFolder(adminUser, category.id, {
      name: 'Bài tập',
      parentId: c2.id,
    });

    await questions.importMany(adminUser, { bankCategoryId: category.id }, [
      cau(baiTap2.id, 'Bài tập'),
    ]);
    expect(await testPrisma.question.count({ where: { categoryId: baiTap2.id } })).toBe(1);
  });

  it('không nhận mã thư mục của kho khác', async () => {
    const { category, khac, adminUser } = await setup();
    const ngoai = await bank.createFolder(adminUser, khac.id, { name: 'Ngoài' });
    await expect(
      questions.importMany(adminUser, { bankCategoryId: category.id }, [cau(ngoai.id)])
    ).rejects.toThrow(/thư mục đích/);
    expect(await testPrisma.question.count()).toBe(0);
  });
});
