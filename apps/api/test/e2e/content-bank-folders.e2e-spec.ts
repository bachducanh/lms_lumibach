import { beforeEach, describe, expect, it } from 'vitest';
import type { Cache } from 'cache-manager';
import { testPrisma } from '../db';
import { createTestCategory, createTestCourse, createTestUser } from '../factories';
import { CategoryContentBankService } from '@/modules/modules/category-content-bank.service';
import { ContentBankService } from '@/modules/modules/content-bank.service';
import { CategoriesService } from '@/modules/categories/categories.service';
import { CategoryBankAccessService } from '@/modules/categories/category-bank-access.service';
import { ModuleItemCleanupService } from '@/common/storage/module-item-cleanup.service';
import type { StorageService } from '@/common/storage/storage.service';
import type { AuthUser } from '@/common/auth/auth.types';

/**
 * Thư mục lồng nhau trong ngân hàng NỘI DUNG, và chuyển hoạt động giữa chúng.
 *
 * Cùng bộ quy tắc với thư mục của ngân hàng câu hỏi, chỉ khác: hoạt động luôn
 * phải nằm trong một thư mục, và xoá thư mục thì phải dọn cả nội dung bên trong
 * (bài giảng, bài tập…) chứ không chỉ xoá dòng ModuleItem.
 */

const noopCache = { del: async () => undefined } as unknown as Cache;
// Bài giảng trong test không có ảnh hay file đính kèm nào — kho tệp không bao
// giờ phải xoá gì, chỉ cần trả lời "không có đường dẫn nào".
const khongLuuTru = {
  removeByUrls: async () => undefined,
  extractUrlsFromHtml: () => [],
  parseUrl: () => null,
} as unknown as StorageService;

function makeService() {
  const categories = new CategoriesService(testPrisma, noopCache, {
    log: async () => undefined,
  } as never);
  return new CategoryContentBankService(
    testPrisma,
    new CategoryBankAccessService(testPrisma, categories),
    khongLuuTru,
    new ModuleItemCleanupService(testPrisma, khongLuuTru),
    {} as ContentBankService
  );
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

/** Một bài giảng trong thư mục của kho, kèm bản ghi nội dung thật. */
async function taoBaiGiang(moduleId: string, createdBy: string, title = 'Bài giảng') {
  const lesson = await testPrisma.lesson.create({ data: { title, content: '', createdBy } });
  const last = await testPrisma.moduleItem.findFirst({
    where: { moduleId },
    orderBy: { position: 'desc' },
  });
  return testPrisma.moduleItem.create({
    data: {
      moduleId,
      type: 'LESSON',
      title,
      lessonId: lesson.id,
      position: (last?.position ?? -1) + 1,
      isPublished: true,
    },
  });
}

describe('Thư mục con trong kho nội dung', () => {
  let bank: CategoryContentBankService;

  beforeEach(() => {
    bank = makeService();
  });

  it('tạo thư mục con nhiều cấp, trả về phẳng kèm parentId', async () => {
    const { category, adminUser } = await setup();
    const chuong = await bank.createModule(adminUser, category.id, { name: 'Chủ đề A' });
    const bai = await bank.createModule(adminUser, category.id, {
      name: 'Bài 1',
      parentId: chuong.id,
    });

    const data = await bank.get(adminUser, category.id);
    const cha = Object.fromEntries(data.modules.map((m) => [m.id, m.parentId]));
    expect(cha).toEqual({ [chuong.id]: null, [bai.id]: chuong.id });
  });

  it('không nhận thư mục cha của kho khác', async () => {
    const { category, khac, adminUser } = await setup();
    const ngoai = await bank.createModule(adminUser, khac.id, { name: 'Ngoài' });
    await expect(
      bank.createModule(adminUser, category.id, { name: 'Con', parentId: ngoai.id })
    ).rejects.toThrow(/kho này/);
  });

  it('chuyển thư mục, và chặn chuyển vào nhánh con của chính nó', async () => {
    const { category, adminUser } = await setup();
    const a = await bank.createModule(adminUser, category.id, { name: 'A' });
    const b = await bank.createModule(adminUser, category.id, { name: 'B', parentId: a.id });
    const c = await bank.createModule(adminUser, category.id, { name: 'C' });

    await expect(bank.moveModule(adminUser, a.id, { parentId: b.id })).rejects.toThrow(
      /thư mục con/
    );
    await bank.moveModule(adminUser, a.id, { parentId: c.id });
    expect((await testPrisma.module.findUnique({ where: { id: a.id } }))!.parentId).toBe(c.id);
    await bank.moveModule(adminUser, a.id, { parentId: null });
    expect((await testPrisma.module.findUnique({ where: { id: a.id } }))!.parentId).toBeNull();
  });

  it('xoá thư mục cha thì xoá cả nhánh và dọn nội dung của mọi hoạt động bên trong', async () => {
    const { category, adminUser } = await setup();
    const a = await bank.createModule(adminUser, category.id, { name: 'A' });
    const b = await bank.createModule(adminUser, category.id, { name: 'B', parentId: a.id });
    const giu = await bank.createModule(adminUser, category.id, { name: 'Giữ' });
    await taoBaiGiang(a.id, adminUser.id);
    const trongCon = await taoBaiGiang(b.id, adminUser.id);
    const conLai = await taoBaiGiang(giu.id, adminUser.id);

    const res = await bank.deleteModule(adminUser, a.id);
    expect(res.message).toContain('1 thư mục con');
    expect(res.message).toContain('2 hoạt động');

    expect((await testPrisma.module.findMany()).map((m) => m.id)).toEqual([giu.id]);
    expect((await testPrisma.moduleItem.findMany()).map((i) => i.id)).toEqual([conLai.id]);
    // Bài giảng của thư mục con bị xoá thật, không thành bản ghi mồ côi.
    expect(await testPrisma.lesson.count({ where: { id: trongCon.lessonId! } })).toBe(0);
    expect(await testPrisma.lesson.count()).toBe(1);
  });

  it('giáo viên không xoá được nhánh có thư mục con của người khác', async () => {
    const { category, adminUser, teacherUser } = await setup();
    const cuaGv = await bank.createModule(teacherUser, category.id, { name: 'Của GV' });
    await bank.createModule(adminUser, category.id, { name: 'Của admin', parentId: cuaGv.id });

    await expect(bank.deleteModule(teacherUser, cuaGv.id)).rejects.toThrow(/thư mục con/);
    expect(await testPrisma.module.count()).toBe(2);
  });
});

describe('Chuyển hoạt động giữa các thư mục của kho', () => {
  let bank: CategoryContentBankService;

  beforeEach(() => {
    bank = makeService();
  });

  it('chuyển sang thư mục khác, xếp nối vào cuối theo đúng thứ tự đã chọn', async () => {
    const { category, adminUser } = await setup();
    const a = await bank.createModule(adminUser, category.id, { name: 'A' });
    const b = await bank.createModule(adminUser, category.id, { name: 'B', parentId: a.id });
    const coSan = await taoBaiGiang(b.id, adminUser.id, 'Có sẵn');
    const x = await taoBaiGiang(a.id, adminUser.id, 'X');
    const y = await taoBaiGiang(a.id, adminUser.id, 'Y');

    const res = await bank.moveItems(adminUser, [y.id, x.id], b.id);
    expect(res.moved).toBe(2);

    const trongB = await testPrisma.moduleItem.findMany({
      where: { moduleId: b.id },
      orderBy: { position: 'asc' },
    });
    expect(trongB.map((i) => i.id)).toEqual([coSan.id, y.id, x.id]);
  });

  it('không chuyển sang thư mục của kho khác', async () => {
    const { category, khac, adminUser } = await setup();
    const a = await bank.createModule(adminUser, category.id, { name: 'A' });
    const ngoai = await bank.createModule(adminUser, khac.id, { name: 'Ngoài' });
    const x = await taoBaiGiang(a.id, adminUser.id);

    await expect(bank.moveItems(adminUser, [x.id], ngoai.id)).rejects.toThrow(/cùng một kho/);
    expect((await testPrisma.moduleItem.findUnique({ where: { id: x.id } }))!.moduleId).toBe(a.id);
  });

  it('giáo viên không chuyển được vào thư mục của người khác', async () => {
    const { category, adminUser, teacherUser } = await setup();
    const cuaGv = await bank.createModule(teacherUser, category.id, { name: 'Của GV' });
    const cuaAdmin = await bank.createModule(adminUser, category.id, { name: 'Của admin' });
    const x = await taoBaiGiang(cuaGv.id, teacherUser.id);

    await expect(bank.moveItems(teacherUser, [x.id], cuaAdmin.id)).rejects.toThrow();
    expect((await testPrisma.moduleItem.findUnique({ where: { id: x.id } }))!.moduleId).toBe(
      cuaGv.id
    );
  });

  it('không nhận hoạt động của khoá học, chỉ hoạt động trong kho', async () => {
    const { category, adminUser } = await setup();
    const a = await bank.createModule(adminUser, category.id, { name: 'A' });
    const course = await createTestCourse({ ownerId: adminUser.id, categoryId: category.id });
    const chuongLop = await testPrisma.module.create({
      data: { courseId: course.id, name: 'Chương lớp', position: 0 },
    });
    const cuaLop = await taoBaiGiang(chuongLop.id, adminUser.id);

    await expect(bank.moveItems(adminUser, [cuaLop.id], a.id)).rejects.toThrow(/cùng một kho/);
  });
});
