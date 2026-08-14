import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import type {
  BankModuleBody,
  CategoryContentBankData,
  CreateBankLessonBody,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';
import { CategoryBankAccessService } from '../categories/category-bank-access.service';
import { StorageService } from '../../common/storage/storage.service';
import { ModuleItemCleanupService } from '../../common/storage/module-item-cleanup.service';

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
    private readonly cleanup: ModuleItemCleanupService
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
          items: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              type: true,
              title: true,
              updatedAt: true,
              lessonId: true,
              lesson: { select: { estimatedMinutes: true } },
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
        items: m.items.map((i) => ({
          id: i.id,
          type: i.type as string,
          title: i.title,
          lessonId: i.lessonId,
          updatedAt: i.updatedAt.toISOString(),
          detail: i.lesson?.estimatedMinutes ? `${i.lesson.estimatedMinutes} phút` : '',
        })),
      })),
    };
  }

  // ── Chương trong kho ────────────────────────────────────────

  async createModule(
    user: AuthUser,
    categoryId: string,
    body: BankModuleBody
  ): Promise<{ id: string }> {
    await this.access.assertCanManage(user, categoryId);

    const last = await this.prisma.module.findFirst({
      where: { bankCategoryId: categoryId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    return this.prisma.module.create({
      // courseId để trống: CHECK ở CSDL bắt buộc đúng một chủ sở hữu.
      data: {
        bankCategoryId: categoryId,
        name: body.name,
        position: (last?.position ?? -1) + 1,
        createdBy: user.id,
      },
      select: { id: true },
    });
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
    return { message: 'Đã đổi tên chương.' };
  }

  /**
   * Xoá chương của kho VÀ toàn bộ hoạt động bên trong.
   *
   * Khác thư mục của ngân hàng câu hỏi (xoá thư mục thì câu hỏi rơi về nhóm
   * "chưa xếp"): hoạt động chỉ tồn tại thông qua ModuleItem, không có chỗ nào
   * khác để rơi về. Dùng lại ModuleItemCleanupService nên bài giảng, file đính
   * kèm và object trên MinIO đều được dọn thay vì thành rác mồ côi.
   */
  async deleteModule(user: AuthUser, moduleId: string): Promise<{ message: string }> {
    await this.loadModuleForEdit(user, moduleId);

    const itemIds = await this.cleanup.moduleItemIdsOfModule(moduleId);
    const plan = await this.cleanup.planPurge(itemIds);

    await this.prisma.$transaction([
      ...this.cleanup.purgeOperations(plan),
      this.prisma.module.delete({ where: { id: moduleId } }),
    ]);
    await this.storage.removeByUrls(plan.fileUrls);

    return {
      message:
        itemIds.length > 0
          ? `Đã xoá chương và ${itemIds.length} hoạt động bên trong.`
          : 'Đã xoá chương.',
    };
  }

  // ── Hoạt động trong kho ─────────────────────────────────────

  /**
   * Thêm bài giảng vào một chương của kho.
   *
   * Bài giảng là loại duy nhất soạn thẳng được ở đây mà không phải sửa gì ở
   * tầng dữ liệu: `Lesson` vốn không có `courseId`, nó chỉ treo vào ModuleItem.
   * Các loại còn lại (bài tập, quiz, bài code, đề luyện tập, diễn đàn) vào kho
   * qua nút "Chia sẻ" ở lớp — cột `bankCategoryId` của chúng đã sẵn sàng cho
   * việc soạn thẳng, phần giao diện soạn là việc còn lại.
   */
  async createLesson(
    user: AuthUser,
    moduleId: string,
    body: CreateBankLessonBody
  ): Promise<{ lessonId: string; itemId: string }> {
    const mod = await this.prisma.module.findUnique({
      where: { id: moduleId },
      select: { id: true, bankCategoryId: true },
    });
    if (!mod?.bankCategoryId) {
      throw new NotFoundException('Không tìm thấy chương trong kho của danh mục.');
    }
    await this.access.assertCanManage(user, mod.bankCategoryId);

    const lesson = await this.prisma.lesson.create({
      data: {
        title: body.title,
        content: body.content ?? '',
        estimatedMinutes: body.estimatedMinutes ?? null,
        createdBy: user.id,
      },
      select: { id: true },
    });

    const last = await this.prisma.moduleItem.findFirst({
      where: { moduleId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const item = await this.prisma.moduleItem.create({
      data: {
        moduleId,
        type: 'LESSON',
        position: (last?.position ?? -1) + 1,
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

    const plan = await this.cleanup.planPurge([itemId]);
    await this.prisma.$transaction(this.cleanup.purgeOperations(plan));
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
