import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import { TRASH_RETENTION_DAYS, TRASHED_ACTIVITY_KINDS } from '@lumibach/types';
import type { TrashedActivityItem, TrashedActivityKind } from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';
import { canManageCourse } from '../../common/auth/course-access';
import { AuditService } from '../../common/audit/audit.service';

/** Dòng tối thiểu cần cho thùng rác — bốn bảng hoạt động đều có đủ các cột này. */
type TrashRow = {
  id: string;
  title: string;
  deletedAt: Date | null;
  courseId: string;
  course: { id: string; name: string; slug: string };
};

type CourseScope = { course?: { OR: object[] } };

/**
 * Thùng rác cho hoạt động học tập (bài tập, quiz, bài code, đề ôn).
 *
 * Xoá một hoạt động — dù từ tab riêng hay từ trang Chương — chỉ đặt `deletedAt`.
 * Trước đây không màn hình nào đọc cột đó nên hoạt động biến mất không dấu vết:
 * giáo viên lỡ tay là mất luôn bài tập kèm bài nộp của cả lớp. Lớp này cho xem
 * lại, khôi phục, hoặc xoá hẳn, và dọn tự động sau TRASH_RETENTION_DAYS ngày
 * giống hệt khoá học.
 *
 * Bốn loại nằm ở bốn bảng Prisma khác nhau. Không gom delegate vào một map được
 * (union của các delegate không gọi động được, TS2349), nên mỗi thao tác dùng
 * một switch tường minh — dài hơn nhưng kiểu chuẩn và đọc thẳng ra SQL.
 */
@Injectable()
export class ActivityTrashService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService
  ) {}

  private daysLeft(deletedAt: Date): number {
    const ageDays = Math.floor((Date.now() - deletedAt.getTime()) / (24 * 60 * 60 * 1000));
    return Math.max(0, TRASH_RETENTION_DAYS - ageDays);
  }

  private async findDeletedRows(
    kind: TrashedActivityKind,
    where: { deletedAt: { not: null } | { not: null; lt: Date } } & CourseScope
  ): Promise<TrashRow[]> {
    const args = {
      // `courseId: { not: null }` là bắt buộc, không phải thừa: bản mẫu trong
      // ngân hàng nội dung của danh mục cũng có cột deletedAt, mà thùng rác này
      // luôn hiển thị kèm tên lớp và cho khôi phục về lớp. Thiếu điều kiện đó
      // thì khi gọi không kèm CourseScope (view của ADMIN, job dọn rác), bản mẫu
      // lọt vào danh sách với course = null.
      where: { ...where, courseId: { not: null } },
      orderBy: { deletedAt: 'desc' as const },
      select: {
        id: true,
        title: true,
        deletedAt: true,
        courseId: true,
        course: { select: { id: true, name: true, slug: true } },
      },
    };
    switch (kind) {
      case 'assignment':
        return this.prisma.assignment.findMany(args) as Promise<TrashRow[]>;
      case 'quiz':
        return this.prisma.quiz.findMany(args) as Promise<TrashRow[]>;
      case 'code-exercise':
        return this.prisma.codeExercise.findMany(args) as Promise<TrashRow[]>;
      case 'practice-test':
        return this.prisma.practiceTest.findMany(args) as Promise<TrashRow[]>;
    }
  }

  private countSubmissions(kind: TrashedActivityKind, id: string): Promise<number> {
    switch (kind) {
      case 'assignment':
        return this.prisma.submission.count({ where: { assignmentId: id } });
      case 'quiz':
        return this.prisma.quizAttempt.count({ where: { quizId: id } });
      case 'code-exercise':
        return this.prisma.codeSubmission.count({ where: { codeExerciseId: id } });
      case 'practice-test':
        return this.prisma.practiceTestAttempt.count({ where: { practiceTestId: id } });
    }
  }

  /**
   * ADMIN thấy mọi hoạt động đã xoá; giáo viên chỉ thấy của khoá mình quản lý
   * (chủ khoá hoặc co-teacher) — khớp với quyền xoá chúng ngay từ đầu.
   */
  async list(actor: AuthUser): Promise<TrashedActivityItem[]> {
    if (actor.role !== 'ADMIN' && actor.role !== 'TEACHER') {
      throw new ForbiddenException('Không có quyền xem thùng rác');
    }

    const scope: CourseScope =
      actor.role === 'ADMIN'
        ? {}
        : {
            course: {
              OR: [{ ownerId: actor.id }, { coTeachers: { some: { userId: actor.id } } }],
            },
          };

    const items: TrashedActivityItem[] = [];
    for (const kind of TRASHED_ACTIVITY_KINDS) {
      const rows = await this.findDeletedRows(kind, { deletedAt: { not: null }, ...scope });
      for (const row of rows) {
        const deletedAt = row.deletedAt as Date;
        items.push({
          id: row.id,
          kind,
          title: row.title,
          courseId: row.course.id,
          courseName: row.course.name,
          courseSlug: row.course.slug,
          deletedAt: deletedAt.toISOString(),
          daysLeft: this.daysLeft(deletedAt),
          submissionCount: await this.countSubmissions(kind, row.id),
        });
      }
    }

    return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }

  /** Tìm hoạt động đã xoá + kiểm tra quyền quản lý khoá chứa nó. */
  private async findDeleted(actor: AuthUser, kind: TrashedActivityKind, id: string) {
    if (!TRASHED_ACTIVITY_KINDS.includes(kind)) {
      throw new NotFoundException('Loại hoạt động không hợp lệ');
    }
    const rows = await this.findDeletedRows(kind, { deletedAt: { not: null } });
    const row = rows.find((r) => r.id === id);
    if (!row) throw new NotFoundException('Không tìm thấy hoạt động trong thùng rác');

    if (actor.role !== 'ADMIN' && !(await canManageCourse(this.prisma, actor, row.courseId))) {
      throw new ForbiddenException('Bạn không quản lý khoá học chứa hoạt động này');
    }
    return row;
  }

  /**
   * Khôi phục = bỏ `deletedAt`. Hoạt động hiện lại ở tab riêng của nó nhưng
   * KHÔNG tự quay về chương cũ: ModuleItem đã bị xoá hẳn lúc đó và không lưu
   * vị trí cũ. Giáo viên xếp lại vào chương mong muốn.
   */
  async restore(
    actor: AuthUser,
    kind: TrashedActivityKind,
    id: string
  ): Promise<{ message: string }> {
    const row = await this.findDeleted(actor, kind, id);
    const data = { deletedAt: null };
    switch (kind) {
      case 'assignment':
        await this.prisma.assignment.update({ where: { id }, data });
        break;
      case 'quiz':
        await this.prisma.quiz.update({ where: { id }, data });
        break;
      case 'code-exercise':
        await this.prisma.codeExercise.update({ where: { id }, data });
        break;
      case 'practice-test':
        await this.prisma.practiceTest.update({ where: { id }, data });
        break;
    }

    this.audit.log({
      userId: actor.id,
      userRole: actor.role,
      action: 'ACTIVITY_RESTORE',
      resource: 'Activity',
      resourceId: id,
      metadata: { kind, title: row.title, courseId: row.courseId },
    });
    return { message: 'Đã khôi phục. Vào trang Chương để xếp lại vào chương nếu cần.' };
  }

  /** Xoá vĩnh viễn khỏi CSDL, kèm mọi bài làm liên quan. */
  async purge(
    actor: AuthUser,
    kind: TrashedActivityKind,
    id: string
  ): Promise<{ message: string }> {
    const row = await this.findDeleted(actor, kind, id);
    await this.purgeOne(kind, id);

    this.audit.log({
      userId: actor.id,
      userRole: actor.role,
      action: 'ACTIVITY_PURGE',
      resource: 'Activity',
      resourceId: id,
      metadata: { kind, title: row.title, courseId: row.courseId },
    });
    return { message: 'Đã xoá vĩnh viễn.' };
  }

  /** Dọn hoạt động quá hạn giữ. Gọi từ cron — không có actor. */
  async purgeExpired(): Promise<{ purged: number }> {
    const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    let purged = 0;

    for (const kind of TRASHED_ACTIVITY_KINDS) {
      const expired = await this.findDeletedRows(kind, { deletedAt: { not: null, lt: cutoff } });
      for (const row of expired) {
        await this.purgeOne(kind, row.id);
        this.audit.log({
          action: 'ACTIVITY_PURGE_EXPIRED',
          resource: 'Activity',
          resourceId: row.id,
          metadata: { kind, title: row.title },
        });
        purged += 1;
      }
    }
    return { purged };
  }

  /**
   * Xoá cứng một hoạt động.
   *
   * Quiz / đề ôn / bài code nằm ở giao của hai nhánh cascade (bài làm của học
   * sinh ↔ định nghĩa câu hỏi, test case), mà nhánh trỏ tới phần định nghĩa khai
   * onDelete mặc định = RESTRICT. Postgres kiểm RESTRICT ngay lập tức nên phải
   * dọn tay bảng bài làm trước — cùng lý do đã ghi ở CoursesService.purge().
   */
  private async purgeOne(kind: TrashedActivityKind, id: string): Promise<void> {
    switch (kind) {
      case 'quiz':
        await this.prisma.$transaction([
          this.prisma.answer.deleteMany({ where: { attempt: { quizId: id } } }),
          this.prisma.quiz.delete({ where: { id } }),
        ]);
        return;
      case 'practice-test':
        await this.prisma.$transaction([
          this.prisma.practiceTestAnswer.deleteMany({ where: { attempt: { practiceTestId: id } } }),
          this.prisma.practiceTest.delete({ where: { id } }),
        ]);
        return;
      case 'code-exercise':
        await this.prisma.$transaction([
          this.prisma.testCaseResult.deleteMany({
            where: { submission: { codeExerciseId: id } },
          }),
          this.prisma.rubricGrade.deleteMany({
            where: { codeSubmission: { codeExerciseId: id } },
          }),
          this.prisma.codeExercise.delete({ where: { id } }),
        ]);
        return;
      case 'assignment':
        await this.prisma.$transaction([
          this.prisma.rubricGrade.deleteMany({ where: { submission: { assignmentId: id } } }),
          this.prisma.assignment.delete({ where: { id } }),
        ]);
        return;
    }
  }
}
