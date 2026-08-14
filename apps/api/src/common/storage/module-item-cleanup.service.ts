import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import { StorageService } from './storage.service';

export type ModuleItemPurgePlan = {
  /** Lesson xoá hẳn — không có nơi nào khác trỏ tới (xem ghi chú bên dưới). */
  lessonIds: string[];
  /** Forum xoá hẳn — diễn đàn chỉ tồn tại như một hoạt động trong chương. */
  forumIds: string[];
  /** Các hoạt động chuyển vào thùng rác (soft-delete) cùng lúc với ModuleItem. */
  assignmentIds: string[];
  quizIds: string[];
  codeExerciseIds: string[];
  practiceTestIds: string[];
  /** File trên MinIO thuộc các lesson bị xoá (đính kèm + ảnh chèn trong nội dung). */
  fileUrls: string[];
};

/** Các cột khoá ngoại nối ModuleItem tới nội dung. */
type LinkField =
  | 'lessonId'
  | 'forumId'
  | 'assignmentId'
  | 'quizId'
  | 'codeExerciseId'
  | 'practiceTestId';

const EMPTY_PLAN: ModuleItemPurgePlan = {
  lessonIds: [],
  forumIds: [],
  assignmentIds: [],
  quizIds: [],
  codeExerciseIds: [],
  practiceTestIds: [],
  fileUrls: [],
};

/**
 * Lập "kế hoạch dọn" khi xoá ModuleItem / Module / Course.
 *
 * Vì sao cần: mọi quan hệ từ ModuleItem sang nội dung đều khai onDelete SetNull,
 * nên cascade của Postgres chỉ xoá đúng dòng ModuleItem. Nội dung ở lại:
 *
 *  - Lesson không có khoá ngoại trỏ ngược lên khoá học, mất ModuleItem là mất
 *    luôn đường truy cập → phải xoá hẳn.
 *  - Assignment / Quiz / CodeExercise / PracticeTest vẫn còn courseId nên tiếp
 *    tục hiện ở tab riêng của chúng, nằm trong nhóm "chưa thuộc chương nào".
 *    Đây chính là hiện tượng xoá trong Chương mà tab Bài tập vẫn còn. Chúng
 *    được soft-delete (deletedAt) giống hệt khi giáo viên xoá thẳng từ tab —
 *    bài nộp và điểm vẫn khôi phục được qua thùng rác.
 *  - Forum chỉ sinh ra cùng hoạt động nên xoá hẳn (topic/post cascade theo).
 *
 * Bên gọi tự chạy phần xoá DB trong transaction của mình, rồi mới gỡ file —
 * xem ghi chú thứ tự ở StorageService.
 */
@Injectable()
export class ModuleItemCleanupService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService
  ) {}

  /**
   * @param moduleItemIds Các ModuleItem sắp bị xoá. Một nội dung chỉ bị dọn khi
   * không còn ModuleItem nào NGOÀI tập này trỏ tới nó (schema cho phép dùng
   * chung, dù luồng tạo hiện tại luôn 1-1).
   */
  async planPurge(moduleItemIds: string[]): Promise<ModuleItemPurgePlan> {
    if (moduleItemIds.length === 0) return EMPTY_PLAN;

    const items = await this.prisma.moduleItem.findMany({
      where: { id: { in: moduleItemIds } },
      select: {
        lessonId: true,
        forumId: true,
        assignmentId: true,
        quizId: true,
        codeExerciseId: true,
        practiceTestId: true,
      },
    });
    if (items.length === 0) return EMPTY_PLAN;

    const pick = (field: LinkField) => [
      ...new Set(items.map((i) => i[field]).filter((v): v is string => !!v)),
    ];

    const [lessonIds, forumIds, assignmentIds, quizIds, codeExerciseIds, practiceTestIds] =
      await Promise.all([
        this.unsharedIds(moduleItemIds, pick('lessonId'), 'lessonId'),
        this.unsharedIds(moduleItemIds, pick('forumId'), 'forumId'),
        this.unsharedIds(moduleItemIds, pick('assignmentId'), 'assignmentId'),
        this.unsharedIds(moduleItemIds, pick('quizId'), 'quizId'),
        this.unsharedIds(moduleItemIds, pick('codeExerciseId'), 'codeExerciseId'),
        this.unsharedIds(moduleItemIds, pick('practiceTestId'), 'practiceTestId'),
      ]);

    return {
      lessonIds,
      forumIds,
      assignmentIds,
      quizIds,
      codeExerciseIds,
      practiceTestIds,
      fileUrls: await this.lessonFileUrls(lessonIds),
    };
  }

  /** Mọi ModuleItem của một khoá học — dùng khi xoá cả khoá. */
  async moduleItemIdsOfCourse(courseId: string): Promise<string[]> {
    const rows = await this.prisma.moduleItem.findMany({
      where: { module: { courseId } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Mọi ModuleItem của một chương. */
  async moduleItemIdsOfModule(moduleId: string): Promise<string[]> {
    const rows = await this.prisma.moduleItem.findMany({
      where: { moduleId },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  // ── Internals ──────────────────────────────────────────────────

  /**
   * Lọc ra id nào SAU khi xoá tập moduleItemIds sẽ không còn ModuleItem nào trỏ
   * tới. Id còn được mục khác dùng chung thì giữ lại nguyên vẹn.
   */
  private async unsharedIds(
    moduleItemIds: string[],
    candidates: string[],
    field: LinkField
  ): Promise<string[]> {
    if (candidates.length === 0) return [];

    const shared = await this.prisma.moduleItem.findMany({
      where: { [field]: { in: candidates }, id: { notIn: moduleItemIds } },
      select: { id: true, [field]: true },
    });
    const sharedIds = new Set(
      shared.map((row) => (row as Record<string, unknown>)[field]).filter(Boolean)
    );
    return candidates.filter((id) => !sharedIds.has(id));
  }

  private async lessonFileUrls(lessonIds: string[]): Promise<string[]> {
    if (lessonIds.length === 0) return [];
    const [attachments, editorImages] = await Promise.all([
      this.prisma.lessonAttachment.findMany({
        where: { lessonId: { in: lessonIds } },
        select: { url: true },
      }),
      this.collectEditorImageUrls(lessonIds),
    ]);
    return [...attachments.map((a) => a.url), ...editorImages];
  }

  /**
   * Ảnh chèn trong nội dung bài giảng (thư mục editor-images/) không có bản ghi
   * DB riêng — phải bới từ HTML. Chỉ nhận đúng tiền tố editor-images/ để không
   * đụng vào link file giáo viên dán từ nơi khác, và bỏ qua ảnh còn được bài
   * giảng khác dùng chung (do copy-paste nội dung).
   */
  private async collectEditorImageUrls(lessonIds: string[]): Promise<string[]> {
    const lessons = await this.prisma.lesson.findMany({
      where: { id: { in: lessonIds } },
      select: { content: true },
    });

    const candidates = [
      ...new Set(lessons.flatMap((l) => this.storage.extractUrlsFromHtml(l.content))),
    ].filter((url) => this.storage.parseUrl(url)?.objectName.startsWith('editor-images/'));
    if (candidates.length === 0) return [];

    const survivors = await this.prisma.lesson.findMany({
      where: {
        id: { notIn: lessonIds },
        OR: candidates.map((url) => ({ content: { contains: url } })),
      },
      select: { content: true },
    });
    if (survivors.length === 0) return candidates;

    return candidates.filter((url) => !survivors.some((s) => s.content.includes(url)));
  }
  /**
   * Các thao tác DB dọn nội dung của một kế hoạch purge — dùng chung cho xoá
   * một hoạt động, xoá cả chương của lớp, và xoá chương trong ngân hàng nội
   * dung của danh mục. Trả về mảng để bên gọi ghép vào transaction của mình
   * cùng lệnh xoá ModuleItem/Module.
   */
  purgeOperations(plan: ModuleItemPurgePlan) {
    const now = new Date();
    const softDelete = { deletedAt: now };
    return [
      this.prisma.lesson.deleteMany({ where: { id: { in: plan.lessonIds } } }),
      this.prisma.forum.deleteMany({ where: { id: { in: plan.forumIds } } }),
      this.prisma.assignment.updateMany({
        where: { id: { in: plan.assignmentIds }, deletedAt: null },
        data: softDelete,
      }),
      this.prisma.quiz.updateMany({
        where: { id: { in: plan.quizIds }, deletedAt: null },
        data: softDelete,
      }),
      this.prisma.codeExercise.updateMany({
        where: { id: { in: plan.codeExerciseIds }, deletedAt: null },
        data: softDelete,
      }),
      this.prisma.practiceTest.updateMany({
        where: { id: { in: plan.practiceTestIds }, deletedAt: null },
        data: softDelete,
      }),
    ];
  }
}
