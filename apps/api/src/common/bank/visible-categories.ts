import type { PrismaClient } from '@lumibach/db';
import { categoryAncestorIds } from './bank-access';

/**
 * Danh mục mà một khoá học được phép LẤY nội dung / câu hỏi từ đó.
 *
 * Đúng hai nguồn:
 *   - Đường dẫn của chính nó — "Tin học", "Khối 10", "10E1". Nội dung soạn ở
 *     tầng trên là soạn cho mọi lớp bên dưới, đó là công dụng của ngân hàng chung.
 *   - Cây con của chính nó — các danh mục nằm dưới lớp này.
 *
 * KHÔNG lấy cây con của các tổ tiên. Bản cũ làm thế, nên tổ tiên cao nhất kéo
 * theo toàn bộ cây của nó: trường có một danh mục gốc chung là mọi lớp nhìn thấy
 * kho của nhau, kể cả khác khối, khác môn. Muốn dùng chung cho cả khối thì soạn
 * thẳng vào kho của "Khối 10" — đúng thứ ngân hàng chung sinh ra để làm.
 *
 * Dùng chung cho cả ngân hàng NỘI DUNG và ngân hàng CÂU HỎI: hai bên từng có
 * hai bản sao y hệt của hàm này, và lệch nhau ở chỗ kiểm phạm vi thì không ai
 * nhận ra cho tới lúc có người thấy thứ không thuộc về mình.
 */
export async function visibleBankCategoryIds(
  prisma: PrismaClient,
  courseCategoryId: string,
  getDescendantIds: (id: string) => Promise<string[]>
): Promise<string[]> {
  const [ancestors, descendants] = await Promise.all([
    categoryAncestorIds(prisma, courseCategoryId),
    getDescendantIds(courseCategoryId),
  ]);
  return [...new Set([...ancestors, ...descendants])];
}
