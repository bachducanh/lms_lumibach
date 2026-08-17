import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import type { AuthUser } from '../../common/auth/auth.types';
import { manageableBankCategoryIds } from '../../common/bank/bank-access';
import { CategoriesService } from './categories.service';

/**
 * Ai được soạn ngân hàng (câu hỏi và nội dung) của một danh mục khoá học.
 *
 * Tách riêng vì hai ngân hàng dùng chung đúng một bộ quy tắc; để mỗi bên tự cài
 * thì sớm muộn cũng lệch nhau, mà lệch ở chỗ kiểm quyền thì không ai nhận ra
 * cho tới lúc có người vào được thứ không phải của mình.
 *
 *   ADMIN    — mọi danh mục.
 *   TEACHER  — danh mục nằm trên ĐƯỜNG DẪN của một khoá họ quản lý. Dạy 10E1
 *              (Tin học / Khối 10 / 10E1) thì soạn được kho của cả ba cấp.
 *              Soạn vào cấp trên là có chủ đích: nội dung của khối dùng cho mọi
 *              lớp con, đúng thứ khiến ngân hàng có ích.
 *   TA       — không.
 *
 * Sửa và xoá siết hơn một bậc: giáo viên chỉ động được vào bản ghi chính mình
 * tạo, ADMIN động được tất cả. Kho là tài sản dùng chung — một lớp đang lấy nội
 * dung từ đó mà người khác sửa ngang thì hỏng việc, và không ai biết vì sao.
 */
@Injectable()
export class CategoryBankAccessService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly categories: CategoriesService
  ) {}

  /**
   * Tập danh mục người dùng được soạn kho. `null` nghĩa là toàn quyền (ADMIN).
   *
   * Luật nằm ở `common/bank/bank-access.ts` vì các service hoạt động (bài tập,
   * quiz, bài code…) cũng phải hỏi cùng câu hỏi này mà không kéo theo cả
   * CategoriesModule. Ở đây chỉ là cửa vào cho tầng ngân hàng.
   */
  async manageableIds(user: AuthUser): Promise<Set<string> | null> {
    return manageableBankCategoryIds(this.prisma, user);
  }

  async assertCanManage(user: AuthUser, categoryId: string): Promise<void> {
    const allowed = await this.manageableIds(user);
    if (allowed === null) return;
    if (!allowed.has(categoryId)) {
      throw new ForbiddenException('Bạn không soạn được kho của danh mục này.');
    }
  }

  /**
   * Chỉ người tạo (hoặc ADMIN) được sửa/xoá một bản ghi trong kho.
   * `createdBy` null là dữ liệu không rõ nguồn — chỉ ADMIN đụng tới.
   */
  assertOwnsRecord(user: AuthUser, createdBy: string | null): void {
    if (user.role === 'ADMIN') return;
    if (createdBy !== user.id) {
      throw new ForbiddenException(
        'Bạn chỉ sửa hoặc xoá được nội dung do chính mình thêm vào kho.'
      );
    }
  }

  /** Đường dẫn đầy đủ của danh mục, ví dụ "Tin học / Khối 10". */
  async pathOf(categoryId: string): Promise<{ name: string; path: string }> {
    const breadcrumb = await this.categories.buildBreadcrumb(categoryId);
    return {
      name: breadcrumb.at(-1)?.name ?? '',
      path: breadcrumb.map((c) => c.name).join(' / '),
    };
  }
}
