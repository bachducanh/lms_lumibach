import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import type { AuthUser } from '../../common/auth/auth.types';
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

  /** Tập danh mục người dùng được soạn kho. `null` nghĩa là toàn quyền (ADMIN). */
  async manageableIds(user: AuthUser): Promise<Set<string> | null> {
    if (user.role === 'ADMIN') return null;
    if (user.role !== 'TEACHER') return new Set();

    const courses = await this.prisma.course.findMany({
      where: {
        deletedAt: null,
        OR: [{ ownerId: user.id }, { coTeachers: { some: { userId: user.id } } }],
      },
      select: { categoryId: true },
    });

    const ids = new Set<string>();
    for (const categoryId of new Set(courses.map((c) => c.categoryId))) {
      const breadcrumb = await this.categories.buildBreadcrumb(categoryId);
      for (const node of breadcrumb) ids.add(node.id);
    }
    return ids;
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
