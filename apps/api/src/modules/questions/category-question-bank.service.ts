import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import type {
  BankFolderBody,
  CategoryQuestionBankData,
  ManageableBankCategory,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';
import { CategoryBankAccessService } from '../categories/category-bank-access.service';

const QUESTION_INCLUDE = {
  options: { orderBy: { position: 'asc' } },
  testCases: { orderBy: { position: 'asc' } },
} as const;

/**
 * Kho câu hỏi soạn THẲNG trong danh mục khoá học.
 *
 * Khác với QuestionBankService (khung nhìn "câu hỏi của lớp khác đang chia sẻ"),
 * ở đây câu hỏi không thuộc khoá nào: nó thuộc về danh mục, nên vẫn còn nguyên
 * khi các lớp trong danh mục kết thúc và bị lưu trữ hoặc xoá.
 *
 * Quy tắc ai được soạn nằm ở CategoryBankAccessService — dùng chung với ngân
 * hàng nội dung để hai bên không lệch nhau.
 */
@Injectable()
export class CategoryQuestionBankService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly access: CategoryBankAccessService
  ) {}

  private assertCanManage(user: AuthUser, categoryId: string): Promise<void> {
    return this.access.assertCanManage(user, categoryId);
  }

  private assertOwnsRecord(user: AuthUser, createdBy: string | null): void {
    this.access.assertOwnsRecord(user, createdBy);
  }

  /** Danh mục người dùng soạn kho được, kèm số câu hỏi để biết chỗ nào đã có gì. */
  async listManageable(user: AuthUser): Promise<ManageableBankCategory[]> {
    const allowed = await this.access.manageableIds(user);

    const rows = await this.prisma.courseCategory.findMany({
      where: {
        deletedAt: null,
        ...(allowed === null ? {} : { id: { in: [...allowed] } }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        _count: { select: { bankQuestions: true, bankModules: true } },
      },
    });

    const items: ManageableBankCategory[] = [];
    for (const row of rows) {
      const { name, path } = await this.access.pathOf(row.id);
      items.push({
        id: row.id,
        name,
        path,
        questionCount: row._count.bankQuestions,
        moduleCount: row._count.bankModules,
      });
    }
    return items.sort((a, b) => a.path.localeCompare(b.path, 'vi'));
  }

  async get(user: AuthUser, categoryId: string): Promise<CategoryQuestionBankData> {
    await this.assertCanManage(user, categoryId);

    const category = await this.prisma.courseCategory.findFirst({
      where: { id: categoryId, deletedAt: null },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Không tìm thấy danh mục khoá học.');

    const [info, folders, uncategorized] = await Promise.all([
      this.access.pathOf(categoryId),
      this.prisma.questionCategory.findMany({
        where: { bankCategoryId: categoryId },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          name: true,
          position: true,
          questions: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            include: QUESTION_INCLUDE,
          },
        },
      }),
      this.prisma.question.findMany({
        where: { bankCategoryId: categoryId, categoryId: null, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: QUESTION_INCLUDE,
      }),
    ]);

    return {
      categoryId,
      categoryName: info.name,
      categoryPath: info.path,
      // Prisma trả `createdAt` kiểu Date còn DTO khai string: JSON.stringify của
      // tầng HTTP đổi sang chuỗi ISO, nên dây truyền đúng kiểu. Giống hệt cách
      // endpoint /questions của khoá học vẫn trả từ trước.
      folders: folders as unknown as CategoryQuestionBankData['folders'],
      uncategorized: uncategorized as unknown as CategoryQuestionBankData['uncategorized'],
    };
  }

  async createFolder(
    user: AuthUser,
    categoryId: string,
    body: BankFolderBody
  ): Promise<{ id: string }> {
    await this.assertCanManage(user, categoryId);

    const last = await this.prisma.questionCategory.findFirst({
      where: { bankCategoryId: categoryId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const created = await this.prisma.questionCategory.create({
      // courseId để trống: CHECK ở CSDL bắt buộc đúng một chủ sở hữu.
      data: {
        bankCategoryId: categoryId,
        name: body.name,
        position: (last?.position ?? -1) + 1,
        createdBy: user.id,
      },
      select: { id: true },
    });
    return created;
  }

  /**
   * Thư mục kho kèm chủ sở hữu, dùng chung cho sửa tên và xoá. Kiểm luôn cả hai
   * bậc quyền tại đây để hai đường sửa/xoá không thể lệch nhau về sau.
   */
  private async loadFolderForEdit(user: AuthUser, folderId: string) {
    const folder = await this.prisma.questionCategory.findUnique({
      where: { id: folderId },
      select: { id: true, bankCategoryId: true, createdBy: true },
    });
    if (!folder?.bankCategoryId) {
      throw new NotFoundException('Không tìm thấy thư mục trong kho của danh mục.');
    }
    await this.assertCanManage(user, folder.bankCategoryId);
    this.assertOwnsRecord(user, folder.createdBy);
    return folder as { id: string; bankCategoryId: string; createdBy: string | null };
  }

  async renameFolder(
    user: AuthUser,
    folderId: string,
    body: BankFolderBody
  ): Promise<{ message: string }> {
    await this.loadFolderForEdit(user, folderId);

    await this.prisma.questionCategory.update({
      where: { id: folderId },
      data: { name: body.name },
    });
    return { message: 'Đã đổi tên thư mục.' };
  }

  /**
   * Xoá thư mục, GIỮ LẠI câu hỏi bên trong.
   *
   * Quan hệ Question.category là `onDelete: SetNull`, nên câu hỏi rơi về nhóm
   * "chưa xếp thư mục" của đúng kho đó chứ không biến mất. Xoá một thư mục là
   * thao tác sắp xếp, không phải thao tác huỷ nội dung.
   */
  async deleteFolder(user: AuthUser, folderId: string): Promise<{ message: string }> {
    await this.loadFolderForEdit(user, folderId);

    const moved = await this.prisma.question.count({
      where: { categoryId: folderId, deletedAt: null },
    });
    await this.prisma.questionCategory.delete({ where: { id: folderId } });

    return {
      message:
        moved > 0
          ? `Đã xoá thư mục. ${moved} câu hỏi chuyển về nhóm chưa xếp thư mục.`
          : 'Đã xoá thư mục.',
    };
  }

  /** Dùng lại bởi QuestionsService khi tạo / sửa / xoá câu hỏi của kho. */
  async assertCanManageBank(user: AuthUser, categoryId: string): Promise<void> {
    await this.assertCanManage(user, categoryId);
  }

  assertCanEditBankQuestion(user: AuthUser, createdBy: string | null): void {
    this.assertOwnsRecord(user, createdBy);
  }
}
