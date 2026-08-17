import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CategoryContentBankData } from '@lumibach/types';

/**
 * Chốt "người này soạn được kho của danh mục này" cho các trang soạn bản mẫu.
 *
 * Vì sao cần: `GET /assignments/:id`, `/quizzes/:id`, `/code-exercises/:id`
 * không kiểm quyền theo danh mục — chúng chỉ trả bản ghi. So khớp `bankCategoryId`
 * với id trên URL mới chỉ chứng minh bản ghi nằm đúng chỗ, chưa chứng minh người
 * đang xem được phép vào chỗ đó. Endpoint kho thì có kiểm (trả 403), nên gọi nó
 * một lần ở đầu trang là đủ; API vẫn chốt lại lần nữa lúc lưu.
 *
 * Trả về client API đã dựng để trang dùng tiếp, khỏi tạo hai lần.
 */
export async function loadBankOrNull(categoryId: string): Promise<{
  api: ReturnType<typeof apiServerClient>;
  bank: CategoryContentBankData;
} | null> {
  const api = apiServerClient(await cookies());
  const bank = await api
    .get<CategoryContentBankData>(`/modules/bank-categories/${categoryId}`)
    .catch(() => null);
  return bank ? { api, bank } : null;
}
