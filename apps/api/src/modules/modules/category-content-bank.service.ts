import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import { thuMucTrongNhanh } from '@lumibach/types';
import type {
  BankModuleBody,
  CategoryContentBankData,
  CourseActivityPickGroup,
  CreateBankActivityBody,
  CreateBankLessonBody,
  CreateBankModuleBody,
  MoveBankModuleBody,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';
import { CategoryBankAccessService } from '../categories/category-bank-access.service';
import { StorageService } from '../../common/storage/storage.service';
import { ModuleItemCleanupService } from '../../common/storage/module-item-cleanup.service';
import { ContentBankService } from './content-bank.service';

/**
 * Ngân hàng NỘI DUNG soạn THẲNG trong danh mục khoá học.
 *
 * Chương ở đây là `Module` có `bankCategoryId` thay vì `courseId`, và hoạt động
 * bên trong là `ModuleItem` như mọi chương khác. Nhờ dùng lại đúng cặp bảng đó,
 * ContentBankService chép nội dung về lớp bằng đúng một đường mã — dù nguồn là
 * kho của danh mục hay là lớp khác đang chia sẻ.
 *
 * Quy tắc quyền dùng chung với ngân hàng câu hỏi (CategoryBankAccessService).
 */
@Injectable()
export class CategoryContentBankService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly access: CategoryBankAccessService,
    private readonly storage: StorageService,
    private readonly cleanup: ModuleItemCleanupService,
    private readonly bank: ContentBankService
  ) {}

  async get(user: AuthUser, categoryId: string): Promise<CategoryContentBankData> {
    await this.access.assertCanManage(user, categoryId);

    const category = await this.prisma.courseCategory.findFirst({
      where: { id: categoryId, deletedAt: null },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Không tìm thấy danh mục khoá học.');

    const [info, modules] = await Promise.all([
      this.access.pathOf(categoryId),
      this.prisma.module.findMany({
        where: { bankCategoryId: categoryId },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          name: true,
          position: true,
          parentId: true,
          items: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              type: true,
              title: true,
              updatedAt: true,
              lessonId: true,
              assignmentId: true,
              quizId: true,
              codeExerciseId: true,
              practiceTestId: true,
              forumId: true,
              lesson: {
                select: { estimatedMinutes: true, _count: { select: { attachments: true } } },
              },
              assignment: { select: { maxScore: true } },
              quiz: { select: { _count: { select: { questions: true } } } },
              codeExercise: { select: { language: true, _count: { select: { testCases: true } } } },
              practiceTest: { select: { _count: { select: { questions: true } } } },
            },
          },
        },
      }),
    ]);

    return {
      categoryId,
      categoryName: info.name,
      categoryPath: info.path,
      modules: modules.map((m) => ({
        id: m.id,
        name: m.name,
        position: m.position,
        parentId: m.parentId,
        items: m.items.map((i) => ({
          id: i.id,
          type: i.type as string,
          title: i.title,
          lessonId: i.lessonId,
          assignmentId: i.assignmentId,
          quizId: i.quizId,
          codeExerciseId: i.codeExerciseId,
          practiceTestId: i.practiceTestId,
          forumId: i.forumId,
          updatedAt: i.updatedAt.toISOString(),
          detail: this.moTa(i),
        })),
      })),
    };
  }

  /** Một dòng mô tả ngắn theo loại — đủ để nhận ra hoạt động mà không mở ra. */
  private moTa(item: {
    lesson: { estimatedMinutes: number | null; _count: { attachments: number } } | null;
    assignment: { maxScore: number } | null;
    quiz: { _count: { questions: number } } | null;
    codeExercise: { language: string; _count: { testCases: number } } | null;
    practiceTest: { _count: { questions: number } } | null;
  }): string {
    if (item.lesson) {
      const parts: string[] = [];
      if (item.lesson.estimatedMinutes) parts.push(`${item.lesson.estimatedMinutes} phút`);
      if (item.lesson._count.attachments) parts.push(`${item.lesson._count.attachments} đính kèm`);
      return parts.join(' · ');
    }
    if (item.assignment) return `Thang điểm ${item.assignment.maxScore}`;
    if (item.quiz) return `${item.quiz._count.questions} câu hỏi`;
    if (item.codeExercise) {
      return `${item.codeExercise.language} · ${item.codeExercise._count.testCases} test case`;
    }
    if (item.practiceTest) return `${item.practiceTest._count.questions} câu`;
    return '';
  }

  // ── Thư mục (chương) trong kho ──────────────────────────────
  //
  // Thư mục lồng nhau bao nhiêu cấp cũng được. Lớp học chép TỪNG hoạt động từ
  // kho về (ContentBankService.copy), không chép cả cây, nên cây thư mục chỉ là
  // cách giáo viên sắp xếp kho — chương của khoá học vẫn phẳng như cũ.

  /** Vị trí kế tiếp trong nhóm anh em (cùng kho, cùng thư mục cha). */
  private async viTriCuoi(bankCategoryId: string, parentId: string | null): Promise<number> {
    const last = await this.prisma.module.findFirst({
      where: { bankCategoryId, parentId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  /** Mọi thư mục của một kho, đủ để dò nhánh con. */
  private lienKetThuMuc(bankCategoryId: string) {
    return this.prisma.module.findMany({
      where: { bankCategoryId },
      select: { id: true, parentId: true, createdBy: true },
    });
  }

  /** Thư mục phải có thật và nằm trong ĐÚNG kho này. */
  private async assertThuMucCuaKho(bankCategoryId: string, moduleId: string): Promise<void> {
    const mod = await this.prisma.module.findFirst({
      where: { id: moduleId, bankCategoryId },
      select: { id: true },
    });
    if (!mod) throw new NotFoundException('Không tìm thấy thư mục trong kho này.');
  }

  async createModule(
    user: AuthUser,
    categoryId: string,
    body: CreateBankModuleBody
  ): Promise<{ id: string }> {
    await this.access.assertCanManage(user, categoryId);
    const parentId = body.parentId ?? null;
    if (parentId) await this.assertThuMucCuaKho(categoryId, parentId);

    return this.prisma.module.create({
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
  }

  /**
   * Chuyển thư mục (kèm mọi thứ bên trong) vào thư mục khác, hoặc ra cấp ngoài
   * cùng khi `parentId` null. Chặn chuyển vào chính nó hay vào nhánh con của nó
   * — làm thế cả nhánh tách khỏi cây, không còn đường nào đi tới nữa.
   */
  async moveModule(
    user: AuthUser,
    moduleId: string,
    body: MoveBankModuleBody
  ): Promise<{ message: string }> {
    const mod = await this.loadModuleForEdit(user, moduleId);
    const parentId = body.parentId;

    const hienTai = await this.prisma.module.findUnique({
      where: { id: moduleId },
      select: { parentId: true },
    });
    if ((hienTai?.parentId ?? null) === parentId) return { message: 'Thư mục đã ở đúng chỗ.' };

    if (parentId) {
      await this.assertThuMucCuaKho(mod.bankCategoryId, parentId);
      const nhanh = thuMucTrongNhanh(await this.lienKetThuMuc(mod.bankCategoryId), moduleId);
      if (nhanh.includes(parentId)) {
        throw new ForbiddenException(
          'Không chuyển được thư mục vào chính nó hay vào một thư mục con của nó.'
        );
      }
    }

    await this.prisma.module.update({
      where: { id: moduleId },
      data: { parentId, position: await this.viTriCuoi(mod.bankCategoryId, parentId) },
    });
    return { message: parentId ? 'Đã chuyển thư mục.' : 'Đã đưa thư mục ra cấp ngoài cùng.' };
  }

  /** Chương của kho kèm chủ sở hữu; kiểm cả hai bậc quyền tại một chỗ. */
  private async loadModuleForEdit(user: AuthUser, moduleId: string) {
    const mod = await this.prisma.module.findUnique({
      where: { id: moduleId },
      select: { id: true, bankCategoryId: true, createdBy: true },
    });
    if (!mod?.bankCategoryId) {
      throw new NotFoundException('Không tìm thấy chương trong kho của danh mục.');
    }
    await this.access.assertCanManage(user, mod.bankCategoryId);
    this.access.assertOwnsRecord(user, mod.createdBy);
    return mod as { id: string; bankCategoryId: string; createdBy: string | null };
  }

  async renameModule(
    user: AuthUser,
    moduleId: string,
    body: BankModuleBody
  ): Promise<{ message: string }> {
    await this.loadModuleForEdit(user, moduleId);
    await this.prisma.module.update({ where: { id: moduleId }, data: { name: body.name } });
    return { message: 'Đã đổi tên thư mục.' };
  }

  /**
   * Xoá thư mục của kho CÙNG cả nhánh: thư mục con ở mọi cấp và mọi hoạt động
   * bên trong. Hoạt động chỉ tồn tại thông qua ModuleItem, không có chỗ nào khác
   * để rơi về. Dùng lại ModuleItemCleanupService nên bài giảng, file đính kèm và
   * object trên MinIO đều được dọn thay vì thành rác mồ côi; dòng thư mục con và
   * ModuleItem thì CSDL xoá dây chuyền theo thư mục gốc.
   *
   * Giáo viên chỉ xoá được thứ mình tạo (luật chung của kho). Nhánh lẫn thư mục
   * con của người khác thì dừng hẳn và nói rõ, không xoá dở dang.
   */
  async deleteModule(user: AuthUser, moduleId: string): Promise<{ message: string }> {
    const mod = await this.loadModuleForEdit(user, moduleId);

    const lienKet = await this.lienKetThuMuc(mod.bankCategoryId);
    const nhanh = thuMucTrongNhanh(lienKet, moduleId);
    const thuMucCon = lienKet.filter((m) => m.id !== moduleId && nhanh.includes(m.id));
    const cuaNguoiKhac = thuMucCon.filter((m) => !this.access.ownsRecord(user, m.createdBy));
    if (cuaNguoiKhac.length > 0) {
      throw new ForbiddenException(
        `Thư mục có ${cuaNguoiKhac.length} thư mục con do người khác thêm vào — bạn chỉ xoá được nội dung của mình. Nhờ quản trị viên xoá thư mục này.`
      );
    }

    const itemIds = (
      await this.prisma.moduleItem.findMany({
        where: { moduleId: { in: nhanh } },
        select: { id: true },
      })
    ).map((r) => r.id);
    const plan = await this.cleanup.planPurge(itemIds);

    await this.prisma.$transaction([
      ...this.cleanup.purgeOperations(plan),
      this.prisma.module.delete({ where: { id: moduleId } }),
    ]);
    await this.storage.removeByUrls(plan.fileUrls);

    const kemTheo = [
      thuMucCon.length > 0 ? `${thuMucCon.length} thư mục con` : '',
      itemIds.length > 0 ? `${itemIds.length} hoạt động` : '',
    ].filter(Boolean);
    return {
      message:
        kemTheo.length > 0 ? `Đã xoá thư mục cùng ${kemTheo.join(' và ')}.` : 'Đã xoá thư mục.',
    };
  }

  /**
   * Chuyển nhiều hoạt động sang một thư mục của cùng kho — dùng chung cho kéo thả
   * và "Chuyển tới…". Hoạt động được xếp nối vào cuối thư mục đích, giữ thứ tự
   * như lúc chọn.
   *
   * Quyền theo thư mục chứa (hoạt động trong kho không mang người tạo riêng):
   * giáo viên phải là chủ cả thư mục nguồn lẫn thư mục đích — chuyển vào thư mục
   * của người khác là trao luôn quyền sửa cho người đó. Thiếu quyền ở một hoạt
   * động thì không chuyển cái nào.
   */
  async moveItems(
    user: AuthUser,
    ids: string[],
    targetModuleId: string
  ): Promise<{ moved: number; message: string }> {
    const dich = await this.prisma.module.findUnique({
      where: { id: targetModuleId },
      select: { id: true, bankCategoryId: true, createdBy: true },
    });
    if (!dich?.bankCategoryId) {
      throw new NotFoundException('Không tìm thấy thư mục đích trong kho của danh mục.');
    }
    await this.access.assertCanManage(user, dich.bankCategoryId);
    this.access.assertOwnsRecord(user, dich.createdBy);

    const unique = [...new Set(ids)];
    const items = await this.prisma.moduleItem.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        moduleId: true,
        module: { select: { bankCategoryId: true, createdBy: true } },
      },
    });
    if (items.length !== unique.length) {
      throw new NotFoundException(
        'Có hoạt động đã bị xoá hoặc không còn tồn tại. Tải lại trang rồi chọn lại.'
      );
    }
    if (items.some((i) => i.module.bankCategoryId !== dich.bankCategoryId)) {
      throw new ForbiddenException('Chỉ chuyển được hoạt động giữa các thư mục của cùng một kho.');
    }
    for (const i of items) this.access.assertOwnsRecord(user, i.module.createdBy);

    // Hoạt động đã nằm sẵn ở thư mục đích thì để yên, khỏi đẩy xuống cuối.
    const canChuyen = unique.filter((id) => items.find((i) => i.id === id)?.moduleId !== dich.id);
    let viTri =
      (
        await this.prisma.moduleItem.findFirst({
          where: { moduleId: dich.id },
          orderBy: { position: 'desc' },
          select: { position: true },
        })
      )?.position ?? -1;
    await this.prisma.$transaction(
      canChuyen.map((id) =>
        this.prisma.moduleItem.update({
          where: { id },
          data: { moduleId: dich.id, position: (viTri += 1) },
        })
      )
    );

    return { moved: canChuyen.length, message: `Đã chuyển ${canChuyen.length} hoạt động.` };
  }

  // ── Hoạt động trong kho ─────────────────────────────────────

  /** Chương của kho + kiểm quyền soạn, dùng chung cho mọi đường tạo hoạt động. */
  private async loadModuleForCreate(user: AuthUser, moduleId: string): Promise<string> {
    const mod = await this.prisma.module.findUnique({
      where: { id: moduleId },
      select: { id: true, bankCategoryId: true },
    });
    if (!mod?.bankCategoryId) {
      throw new NotFoundException('Không tìm thấy chương trong kho của danh mục.');
    }
    await this.access.assertCanManage(user, mod.bankCategoryId);
    return mod.bankCategoryId;
  }

  /** Vị trí kế tiếp trong một chương của kho. */
  private async nextPosition(moduleId: string): Promise<number> {
    const last = await this.prisma.moduleItem.findFirst({
      where: { moduleId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  /**
   * Tạo KHUNG một hoạt động trong kho: chỉ tiêu đề (và ngôn ngữ với bài code),
   * phần còn lại soạn ở trình soạn riêng của từng loại.
   *
   * Vì sao chỉ tạo khung: mỗi loại đã có một trình soạn đầy đủ dùng cho lớp, và
   * chúng nhận bản mẫu của kho từ khi `canManage` của các service biết tới
   * `bankCategoryId`. Dựng lại biểu mẫu riêng cho kho sẽ sinh ra bản thứ hai của
   * cùng một màn hình, và hai bản đó chắc chắn lệch nhau theo thời gian.
   *
   * Đề luyện tập KHÔNG đi đường này: `PracticeTest.pdfUrl` là cột NOT NULL nên
   * không có "khung rỗng" nào hợp lệ — biểu mẫu của nó gọi thẳng
   * `POST /practice-tests` với `bankCategoryId`.
   */
  async createActivity(
    user: AuthUser,
    moduleId: string,
    body: CreateBankActivityBody
  ): Promise<{ itemId: string; contentId: string }> {
    const bankCategoryId = await this.loadModuleForCreate(user, moduleId);
    const title = body.title.trim();

    const link = await this.createContent(user, bankCategoryId, body, title);

    const item = await this.prisma.moduleItem.create({
      data: {
        moduleId,
        type: body.type,
        position: await this.nextPosition(moduleId),
        title,
        // Nội dung trong kho luôn hiện với người soạn kho; `isPublished` chỉ có
        // nghĩa với học sinh của một lớp, mà kho thì không có học sinh.
        isPublished: true,
        ...link.field,
      },
      select: { id: true },
    });

    return { itemId: item.id, contentId: link.id };
  }

  /** Bản ghi nội dung rỗng cho từng loại + tên cột khoá ngoại của nó. */
  private async createContent(
    user: AuthUser,
    bankCategoryId: string,
    body: CreateBankActivityBody,
    title: string
  ): Promise<{ id: string; field: Record<string, string> }> {
    switch (body.type) {
      case 'ASSIGNMENT': {
        const row = await this.prisma.assignment.create({
          data: { bankCategoryId, title, instructions: '', createdBy: user.id },
          select: { id: true },
        });
        return { id: row.id, field: { assignmentId: row.id } };
      }
      case 'QUIZ': {
        const row = await this.prisma.quiz.create({
          data: { bankCategoryId, title, createdBy: user.id },
          select: { id: true },
        });
        return { id: row.id, field: { quizId: row.id } };
      }
      case 'CODE_EXERCISE': {
        const row = await this.prisma.codeExercise.create({
          data: {
            bankCategoryId,
            title,
            language: (body.language ?? 'PYTHON3') as never,
            createdBy: user.id,
          },
          select: { id: true },
        });
        return { id: row.id, field: { codeExerciseId: row.id } };
      }
      case 'FORUM': {
        const row = await this.prisma.forum.create({
          data: { bankCategoryId, title },
          select: { id: true },
        });
        return { id: row.id, field: { forumId: row.id } };
      }
      case 'PRACTICE_TEST':
        throw new BadRequestException(
          'Đề luyện tập phải có file PDF ngay khi tạo — dùng biểu mẫu tạo đề luyện tập.'
        );
    }
  }

  /**
   * Chép một hoạt động đang có trong lớp vào một chương của kho.
   *
   * Bổ khuyết cho `createActivity`: những gì soạn ở lớp rồi thì không phải soạn
   * lại. Kho nhận BẢN RIÊNG chứ không trỏ về lớp nguồn — xoá lớp không mất bản
   * trong kho, sửa đề ở lớp không đổi bản mẫu.
   */
  async importFromCourse(
    user: AuthUser,
    moduleId: string,
    moduleItemId: string
  ): Promise<{ itemId: string }> {
    const bankCategoryId = await this.loadModuleForCreate(user, moduleId);
    const created = await this.bank.cloneIntoBank(user, moduleItemId, { moduleId, bankCategoryId });
    return { itemId: created.moduleItemId };
  }

  /** Hoạt động của các lớp người này quản lý — nguồn để chọn khi chép vào kho. */
  async listImportable(user: AuthUser): Promise<CourseActivityPickGroup[]> {
    return this.bank.listImportable(user);
  }

  /**
   * Thêm bài giảng vào một chương của kho.
   *
   * Đường riêng vì bài giảng không qua bước "đặt tên rồi mở trình soạn": trình
   * soạn bài giảng vốn tạo và lưu nội dung trong một lần.
   */
  async createLesson(
    user: AuthUser,
    moduleId: string,
    body: CreateBankLessonBody
  ): Promise<{ lessonId: string; itemId: string }> {
    await this.loadModuleForCreate(user, moduleId);

    const lesson = await this.prisma.lesson.create({
      data: {
        title: body.title,
        content: body.content ?? '',
        estimatedMinutes: body.estimatedMinutes ?? null,
        createdBy: user.id,
      },
      select: { id: true },
    });

    const item = await this.prisma.moduleItem.create({
      data: {
        moduleId,
        type: 'LESSON',
        position: await this.nextPosition(moduleId),
        title: body.title,
        lessonId: lesson.id,
        // Nội dung trong kho luôn hiện với người soạn kho; `isPublished` chỉ có
        // nghĩa với học sinh của một lớp, mà kho thì không có học sinh.
        isPublished: true,
      },
      select: { id: true },
    });

    return { lessonId: lesson.id, itemId: item.id };
  }

  /** Xoá một hoạt động khỏi kho, dọn luôn nội dung và file của nó. */
  async deleteItem(user: AuthUser, itemId: string): Promise<{ message: string }> {
    const item = await this.prisma.moduleItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        module: { select: { bankCategoryId: true, createdBy: true } },
      },
    });
    if (!item?.module.bankCategoryId) {
      throw new NotFoundException('Không tìm thấy hoạt động trong kho của danh mục.');
    }
    await this.access.assertCanManage(user, item.module.bankCategoryId);
    this.access.assertOwnsRecord(user, item.module.createdBy);

    // `purgeOperations` chỉ dọn phần NỘI DUNG. Thiếu lệnh xoá ModuleItem ở đây
    // thì bài giảng bị xoá thật nhưng dòng hoạt động vẫn nằm nguyên trong kho
    // (quan hệ khai onDelete SetNull nên nó chỉ mất lessonId) — đúng hiện tượng
    // "bấm thùng rác mà nội dung không biến mất".
    const plan = await this.cleanup.planPurge([itemId]);
    await this.prisma.$transaction([
      ...this.cleanup.purgeOperations(plan),
      this.prisma.moduleItem.delete({ where: { id: itemId } }),
    ]);
    await this.storage.removeByUrls(plan.fileUrls);

    return { message: 'Đã xoá hoạt động khỏi kho.' };
  }

  /** Chốt dùng bởi LessonsService khi sửa bài giảng nằm trong kho. */
  async assertCanEditBankLesson(user: AuthUser, lessonId: string): Promise<boolean> {
    const item = await this.prisma.moduleItem.findFirst({
      where: { lessonId },
      select: { module: { select: { bankCategoryId: true, createdBy: true } } },
    });
    if (!item?.module.bankCategoryId) return false;
    await this.access.assertCanManage(user, item.module.bankCategoryId);
    this.access.assertOwnsRecord(user, item.module.createdBy);
    return true;
  }
}
