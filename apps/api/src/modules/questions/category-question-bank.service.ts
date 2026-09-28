import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
  // Quiz mẫu của ngân hàng nội dung trỏ thẳng vào câu của kho (lớp học thì nhận
  // bản sao). Màn hình cần con số này để báo trước khi xoá.
  _count: { select: { quizzes: { where: { quiz: { deletedAt: null } } } } },
} as const;

/** Đổi `_count` của Prisma thành trường `quizCount` mà DTO khai báo. */
function kemSoQuiz<T extends { _count: { quizzes: number } }>(q: T) {
  const { _count, ...rest } = q;
  return { ...rest, quizCount: _count.quizzes };
}

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
      folders: folders.map((f) => ({
        ...f,
        questions: f.questions.map(kemSoQuiz),
      })) as unknown as CategoryQuestionBankData['folders'],
      uncategorized: uncategorized.map(
        kemSoQuiz
      ) as unknown as CategoryQuestionBankData['uncategorized'],
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
   * Xoá thư mục CÙNG các câu hỏi bên trong (xoá mềm, như xoá từng câu).
   *
   * Trước đây câu hỏi được giữ lại và rơi về nhóm "chưa xếp thư mục". Giáo viên
   * xoá thư mục là để dọn cả nội dung, để lại một đống câu lạc chỗ thì lại phải
   * đi xoá tay từng câu. Bản đã chép về khoá học là bản sao riêng, không bị đụng.
   *
   * Giáo viên chỉ xoá được câu do chính mình thêm (luật chung của kho). Thư mục
   * lẫn câu của người khác thì dừng hẳn và nói rõ, không xoá dở dang.
   */
  async deleteFolder(user: AuthUser, folderId: string): Promise<{ message: string }> {
    await this.loadFolderForEdit(user, folderId);

    const questions = await this.prisma.question.findMany({
      where: { categoryId: folderId, deletedAt: null },
      select: { id: true, createdBy: true },
    });
    const cuaNguoiKhac = questions.filter((q) => !this.access.ownsRecord(user, q.createdBy));
    if (cuaNguoiKhac.length > 0) {
      throw new ForbiddenException(
        `Thư mục có ${cuaNguoiKhac.length} câu hỏi do người khác thêm vào — bạn chỉ xoá được câu của mình. Nhờ quản trị viên xoá thư mục này.`
      );
    }

    await this.prisma.$transaction([
      this.prisma.question.updateMany({
        where: { id: { in: questions.map((q) => q.id) } },
        data: { deletedAt: new Date() },
      }),
      this.prisma.questionCategory.delete({ where: { id: folderId } }),
    ]);

    return {
      message:
        questions.length > 0
          ? `Đã xoá thư mục và ${questions.length} câu hỏi bên trong.`
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
