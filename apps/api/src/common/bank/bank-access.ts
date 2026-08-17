import type { PrismaClient } from '@lumibach/db';

/**
 * Quy tắc "ai được soạn ngân hàng của một danh mục khoá học", ở dạng hàm thuần.
 *
 *   ADMIN    — mọi danh mục.
 *   TEACHER  — danh mục nằm trên ĐƯỜNG DẪN của một khoá họ quản lý. Dạy 10E1
 *              (Tin học / Khối 10 / 10E1) thì soạn được kho của cả ba cấp.
 *   TA       — không.
 *
 * Vì sao là hàm thuần chứ không phải service: quy tắc này giờ phải dùng được cả
 * ở AssignmentsService, QuizzesService, CodeExercisesService… — những nơi chỉ
 * nhận PrismaClient và không nên kéo theo CategoriesModule chỉ để hỏi một câu.
 * CategoryBankAccessService vẫn là cửa vào quen thuộc cho tầng ngân hàng, nhưng
 * nó gọi xuống đây chứ không tự cài lại — hai bản luật lệch nhau là kiểu lỗ
 * hổng không ai nhận ra cho tới lúc có người vào được thứ không phải của mình.
 */

type BankUser = { id: string; role: string };

/** Chuỗi id từ gốc tới `categoryId` (gồm chính nó). */
export async function categoryAncestorIds(
  prisma: PrismaClient,
  categoryId: string
): Promise<string[]> {
  const chain: string[] = [];
  let cursor: string | null = categoryId;
  let safety = 0;
  while (cursor && safety < 50) {
    const node: { id: string; parentId: string | null } | null =
      await prisma.courseCategory.findUnique({
        where: { id: cursor },
        select: { id: true, parentId: true },
      });
    if (!node) break;
    chain.unshift(node.id);
    cursor = node.parentId;
    safety++;
  }
  return chain;
}

/** Tập danh mục người dùng được soạn kho. `null` nghĩa là toàn quyền (ADMIN). */
export async function manageableBankCategoryIds(
  prisma: PrismaClient,
  user: BankUser
): Promise<Set<string> | null> {
  if (user.role === 'ADMIN') return null;
  if (user.role !== 'TEACHER') return new Set();

  const courses = await prisma.course.findMany({
    where: {
      deletedAt: null,
      OR: [{ ownerId: user.id }, { coTeachers: { some: { userId: user.id } } }],
    },
    select: { categoryId: true },
  });

  const ids = new Set<string>();
  for (const categoryId of new Set(courses.map((c) => c.categoryId))) {
    for (const id of await categoryAncestorIds(prisma, categoryId)) ids.add(id);
  }
  return ids;
}

export async function canManageBankCategory(
  prisma: PrismaClient,
  user: BankUser,
  categoryId: string
): Promise<boolean> {
  const allowed = await manageableBankCategoryIds(prisma, user);
  return allowed === null || allowed.has(categoryId);
}
