import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import { StorageService } from './storage.service';

export type LessonPurgePlan = {
  /** Lesson cần xoá tay — cascade không chạm tới (xem ghi chú bên dưới). */
  lessonIds: string[];
  /** File trên MinIO thuộc các lesson đó (đính kèm + ảnh chèn trong nội dung). */
  fileUrls: string[];
};

const EMPTY_PLAN: LessonPurgePlan = { lessonIds: [], fileUrls: [] };

/**
 * Lesson là mảnh nội dung duy nhất không có khoá ngoại trỏ ngược lên khoá học:
 * nó chỉ được nối vào qua ModuleItem.lessonId, mà quan hệ đó khai onDelete:
 * SetNull. Nên khi xoá ModuleItem / Module / Course, bản ghi Lesson và
 * LessonAttachment ở lại vĩnh viễn và không còn đường nào truy cập tới.
 *
 * Service này lập "kế hoạch dọn": cho biết Lesson nào xoá được và file nào cần
 * gỡ khỏi MinIO. Bên gọi tự chạy phần xoá DB trong transaction của mình, rồi
 * mới gỡ file — xem ghi chú thứ tự ở StorageService.
 */
@Injectable()
export class LessonCleanupService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService
  ) {}

  /**
   * @param moduleItemIds Các ModuleItem sắp bị xoá. Một Lesson chỉ được xoá khi
   * không còn ModuleItem nào NGOÀI tập này trỏ tới nó (schema cho phép dùng
   * chung, dù luồng tạo hiện tại luôn 1-1).
   */
  async planPurge(moduleItemIds: string[]): Promise<LessonPurgePlan> {
    if (moduleItemIds.length === 0) return EMPTY_PLAN;

    const owned = await this.prisma.moduleItem.findMany({
      where: { id: { in: moduleItemIds }, lessonId: { not: null } },
      select: { lessonId: true },
    });
    const candidateIds = [...new Set(owned.map((r) => r.lessonId as string))];
    if (candidateIds.length === 0) return EMPTY_PLAN;

    const shared = await this.prisma.moduleItem.findMany({
      where: { lessonId: { in: candidateIds }, id: { notIn: moduleItemIds } },
      select: { lessonId: true },
    });
    const sharedIds = new Set(shared.map((r) => r.lessonId as string));
    const lessonIds = candidateIds.filter((id) => !sharedIds.has(id));
    if (lessonIds.length === 0) return EMPTY_PLAN;

    const [attachments, editorImages] = await Promise.all([
      this.prisma.lessonAttachment.findMany({
        where: { lessonId: { in: lessonIds } },
        select: { url: true },
      }),
      this.collectEditorImageUrls(lessonIds),
    ]);

    return { lessonIds, fileUrls: [...attachments.map((a) => a.url), ...editorImages] };
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
}
