import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import { thuMucTrongNhanh } from '@lumibach/types';
import type {
  BankFolderBody,
  CategoryQuestionBankData,
  CreateBankFolderBody,
  ManageableBankCategory,
  MoveBankFolderBody,
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
          parentId: true,
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

  /** Vị trí kế tiếp trong nhóm anh em (cùng kho, cùng thư mục cha). */
  private async viTriCuoi(bankCategoryId: string, parentId: string | null): Promise<number> {
    const last = await this.prisma.questionCategory.findFirst({
      where: { bankCategoryId, parentId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  /** Thư mục cha phải có thật và nằm trong ĐÚNG kho này. */
  private async assertThuMucCuaKho(bankCategoryId: string, folderId: string): Promise<void> {
    const cha = await this.prisma.questionCategory.findFirst({
      where: { id: folderId, bankCategoryId },
      select: { id: true },
    });
    if (!cha) throw new NotFoundException('Không tìm thấy thư mục cha trong kho này.');
  }

  /**
   * Tạo thư mục, hoặc thư mục con khi có `parentId` — lồng bao nhiêu cấp cũng
   * được. Ai soạn được kho thì tạo được thư mục con ở bất kỳ đâu trong kho, như
   * việc thêm câu hỏi vào thư mục của người khác vốn vẫn được.
   */
  async createFolder(
    user: AuthUser,
    categoryId: string,
    body: CreateBankFolderBody
  ): Promise<{ id: string }> {
    await this.assertCanManage(user, categoryId);
    const parentId = body.parentId ?? null;
    if (parentId) await this.assertThuMucCuaKho(categoryId, parentId);

    const created = await this.prisma.questionCategory.create({
      // courseId để trống: CHECK ở CSDL bắt buộc đúng một chủ sở hữu.
      data: {
        bankCategoryId: categoryId,
        parentId,
        name: body.name,
        position: await this.viTriCuoi(categoryId, parentId),
        createdBy: user.id,
      },
      select: { id: true },
    });
    return created;
  }

  /**
   * Chuyển thư mục (kèm mọi thứ bên trong) vào thư mục khác, hoặc ra cấp ngoài
   * cùng khi `parentId` null. Chặn chuyển vào chính nó hay vào nhánh con của nó
   * — làm thế cả nhánh tách khỏi cây, không còn đường nào đi tới nữa.
   */
  async moveFolder(
    user: AuthUser,
    folderId: string,
    body: MoveBankFolderBody
  ): Promise<{ message: string }> {
    const folder = await this.loadFolderForEdit(user, folderId);
    const parentId = body.parentId;

    const hienTai = await this.prisma.questionCategory.findUnique({
      where: { id: folderId },
      select: { parentId: true },
    });
    if ((hienTai?.parentId ?? null) === parentId) return { message: 'Thư mục đã ở đúng chỗ.' };

    if (parentId) {
      await this.assertThuMucCuaKho(folder.bankCategoryId, parentId);
      const nhanh = thuMucTrongNhanh(await this.lienKetThuMuc(folder.bankCategoryId), folderId);
      if (nhanh.includes(parentId)) {
        throw new ForbiddenException(
          'Không chuyển được thư mục vào chính nó hay vào một thư mục con của nó.'
        );
      }
    }

    await this.prisma.questionCategory.update({
      where: { id: folderId },
      data: { parentId, position: await this.viTriCuoi(folder.bankCategoryId, parentId) },
    });
    return {
      message: parentId ? 'Đã chuyển thư mục.' : 'Đã đưa thư mục ra cấp ngoài cùng.',
    };
  }

  /** Mọi thư mục của một kho, đủ để dò nhánh con. */
  private lienKetThuMuc(bankCategoryId: string) {
    return this.prisma.questionCategory.findMany({
      where: { bankCategoryId },
      select: { id: true, parentId: true, createdBy: true },
    });
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
   * Thư mục con xoá theo cả nhánh (CSDL xoá dây chuyền thư mục; câu hỏi ở mọi
   * cấp được xoá mềm ở đây trước).
   *
   * Giáo viên chỉ xoá được thứ do chính mình thêm (luật chung của kho). Nhánh
   * lẫn câu hay thư mục con của người khác thì dừng hẳn và nói rõ, không xoá
   * dở dang.
   */
  async deleteFolder(user: AuthUser, folderId: string): Promise<{ message: string }> {
    const folder = await this.loadFolderForEdit(user, folderId);

    const lienKet = await this.lienKetThuMuc(folder.bankCategoryId);
    const nhanh = thuMucTrongNhanh(lienKet, folderId);
    const thuMucCon = lienKet.filter((f) => f.id !== folderId && nhanh.includes(f.id));

    const questions = await this.prisma.question.findMany({
      where: { categoryId: { in: nhanh }, deletedAt: null },
      select: { id: true, createdBy: true },
    });
    const cauNguoiKhac = questions.filter((q) => !this.access.ownsRecord(user, q.createdBy));
    const conNguoiKhac = thuMucCon.filter((f) => !this.access.ownsRecord(user, f.createdBy));
    if (cauNguoiKhac.length > 0 || conNguoiKhac.length > 0) {
      const phan = [
        cauNguoiKhac.length > 0 ? `${cauNguoiKhac.length} câu hỏi` : '',
        conNguoiKhac.length > 0 ? `${conNguoiKhac.length} thư mục con` : '',
      ].filter(Boolean);
      throw new ForbiddenException(
        `Thư mục có ${phan.join(' và ')} do người khác thêm vào — bạn chỉ xoá được nội dung của mình. Nhờ quản trị viên xoá thư mục này.`
      );
    }

    await this.prisma.$transaction([
      this.prisma.question.updateMany({
        where: { id: { in: questions.map((q) => q.id) } },
        data: { deletedAt: new Date() },
      }),
      this.prisma.questionCategory.delete({ where: { id: folderId } }),
    ]);

    const kemTheo = [
      thuMucCon.length > 0 ? `${thuMucCon.length} thư mục con` : '',
      questions.length > 0 ? `${questions.length} câu hỏi` : '',
    ].filter(Boolean);
    return {
      message:
        kemTheo.length > 0 ? `Đã xoá thư mục cùng ${kemTheo.join(' và ')}.` : 'Đã xoá thư mục.',
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
