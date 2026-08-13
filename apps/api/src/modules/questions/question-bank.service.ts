import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import type {
  BankQuestionItem,
  CopyQuestionBody,
  QuestionBankQuery,
  QuestionBankResult,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';
import { canManageCourse } from '../../common/auth/course-access';
import { CategoriesService } from '../categories/categories.service';

/**
 * Ngân hàng câu hỏi dùng chung theo danh mục khoá học.
 *
 * Bài toán: mỗi lớp là một khoá học riêng (10E1, 10E2…), nhưng đề thì gần như
 * dùng lại được cho cả khối. Trước đây câu hỏi bị nhốt trong đúng một khoá.
 *
 * Cách làm: giáo viên bật cờ `sharedToCategory` cho câu hỏi; khoá học khác nằm
 * CÙNG NHÁNH cây danh mục nhìn thấy và **sao chép** về kho riêng của mình.
 *
 * Vì sao là bản sao chứ không phải tham chiếu: nếu dùng chung một bản ghi, giáo
 * viên sửa đề ở lớp này sẽ đổi luôn đề lớp khác — có khi lớp đó đang kiểm tra
 * dở. Bản sao khiến mỗi lớp tự chủ; đổi lại là sửa đề gốc không lan sang bản đã
 * copy, và đó là đánh đổi có chủ ý.
 *
 * "Cùng nhánh" = danh mục của khoá, mọi danh mục cha, và mọi danh mục con.
 * Nhờ vậy đề đặt ở "Tin học 10" dùng được cho mọi lớp con, còn đề của 10E2 thì
 * lớp 10E1 (anh em) cũng thấy qua danh mục cha chung.
 */
@Injectable()
export class QuestionBankService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly categories: CategoriesService
  ) {}

  /** Danh mục khoá học mà một khoá được phép lấy câu hỏi từ đó. */
  private async visibleCategoryIds(courseCategoryId: string): Promise<string[]> {
    const [breadcrumb, descendants] = await Promise.all([
      this.categories.buildBreadcrumb(courseCategoryId),
      this.categories.getDescendantIds(courseCategoryId),
    ]);
    // Mỗi tổ tiên kéo theo toàn bộ cây con của nó → lớp anh em cũng vào tầm nhìn.
    const ancestorSubtrees = await Promise.all(
      breadcrumb.map((node) => this.categories.getDescendantIds(node.id))
    );
    return [...new Set([...descendants, ...ancestorSubtrees.flat()])];
  }

  private async assertCanManage(user: AuthUser, courseId: string): Promise<void> {
    if (!(await canManageCourse(this.prisma, user, courseId))) {
      throw new ForbiddenException('Bạn không có quyền quản lý khoá học này');
    }
  }

  /** Bật / tắt chia sẻ một câu hỏi ra ngân hàng chung. */
  async setShared(
    user: AuthUser,
    questionId: string,
    shared: boolean
  ): Promise<{ message: string }> {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, deletedAt: null },
      select: { courseId: true },
    });
    if (!question) throw new NotFoundException('Không tìm thấy câu hỏi');
    await this.assertCanManage(user, question.courseId);

    await this.prisma.question.update({
      where: { id: questionId },
      data: { sharedToCategory: shared },
    });
    return {
      message: shared
        ? 'Đã đưa câu hỏi vào ngân hàng chung của danh mục.'
        : 'Đã gỡ câu hỏi khỏi ngân hàng chung.',
    };
  }

  /** Câu hỏi trong ngân hàng mà khoá học này dùng được (không tính đề của chính nó). */
  async list(user: AuthUser, query: QuestionBankQuery): Promise<QuestionBankResult> {
    await this.assertCanManage(user, query.courseId);

    const course = await this.prisma.course.findUnique({
      where: { id: query.courseId },
      select: { categoryId: true },
    });
    if (!course) throw new NotFoundException('Khoá học không tồn tại');

    const categoryIds = await this.visibleCategoryIds(course.categoryId);

    const rows = await this.prisma.question.findMany({
      where: {
        deletedAt: null,
        sharedToCategory: true,
        // Đề của chính khoá này đã nằm sẵn trong kho riêng, không kể lại.
        courseId: { not: query.courseId },
        course: { deletedAt: null, categoryId: { in: categoryIds } },
        ...(query.type ? { type: query.type as never } : {}),
        ...(query.q ? { content: { contains: query.q, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true,
        type: true,
        content: true,
        points: true,
        createdAt: true,
        course: { select: { id: true, name: true, categoryId: true } },
        category: { select: { name: true } },
        _count: { select: { options: true } },
      },
    });

    // Đường dẫn danh mục hay lặp lại giữa các câu — dựng một lần cho mỗi danh mục.
    const pathCache = new Map<string, string>();
    for (const categoryId of new Set(rows.map((r) => r.course.categoryId))) {
      const breadcrumb = await this.categories.buildBreadcrumb(categoryId);
      pathCache.set(categoryId, breadcrumb.map((c) => c.name).join(' / '));
    }

    const questions: BankQuestionItem[] = rows.map((r) => ({
      id: r.id,
      type: r.type as string,
      content: r.content,
      points: r.points,
      optionCount: r._count.options,
      createdAt: r.createdAt.toISOString(),
      sourceCourseId: r.course.id,
      sourceCourseName: r.course.name,
      sourceCategoryPath: pathCache.get(r.course.categoryId) ?? '',
      sourceCategoryName: r.category?.name ?? null,
    }));

    return {
      questions,
      sourceCourseCount: new Set(questions.map((q) => q.sourceCourseId)).size,
    };
  }

  /**
   * Sao chép một câu hỏi trong ngân hàng về kho riêng của khoá học.
   *
   * Chép cả đáp án và test case; bản sao KHÔNG tự chia sẻ tiếp để ngân hàng
   * không đầy những bản trùng nhau.
   */
  async copy(
    user: AuthUser,
    questionId: string,
    body: CopyQuestionBody
  ): Promise<{ questionId: string }> {
    await this.assertCanManage(user, body.courseId);

    const source = await this.prisma.question.findFirst({
      where: { id: questionId, deletedAt: null },
      include: {
        options: { orderBy: { position: 'asc' } },
        testCases: { orderBy: { position: 'asc' } },
        course: { select: { id: true, categoryId: true, deletedAt: true } },
      },
    });
    if (!source || source.course.deletedAt) throw new NotFoundException('Không tìm thấy câu hỏi');

    // Được copy khi: câu hỏi đang chia sẻ và thuộc nhánh danh mục nhìn thấy được,
    // HOẶC người dùng vốn đã quản lý luôn khoá nguồn (tự copy đề của mình sang lớp khác).
    if (!(await canManageCourse(this.prisma, user, source.course.id))) {
      const target = await this.prisma.course.findUnique({
        where: { id: body.courseId },
        select: { categoryId: true },
      });
      if (!target) throw new NotFoundException('Khoá học không tồn tại');
      const allowed = await this.visibleCategoryIds(target.categoryId);
      if (!source.sharedToCategory || !allowed.includes(source.course.categoryId)) {
        throw new ForbiddenException('Câu hỏi này không nằm trong ngân hàng của khoá học bạn chọn');
      }
    }

    // Kho câu hỏi đích phải thuộc đúng khoá nhận, tránh nhét câu sang khoá khác.
    let categoryId: string | null = null;
    if (body.categoryId) {
      const cat = await this.prisma.questionCategory.findFirst({
        where: { id: body.categoryId, courseId: body.courseId },
        select: { id: true },
      });
      if (!cat) throw new NotFoundException('Kho câu hỏi không thuộc khoá học này');
      categoryId = cat.id;
    }

    const created = await this.prisma.question.create({
      data: {
        courseId: body.courseId,
        categoryId,
        type: source.type,
        content: source.content,
        explanation: source.explanation,
        points: source.points,
        createdBy: user.id,
        starterCode: source.starterCode,
        solutionCode: source.solutionCode,
        timeLimit: source.timeLimit,
        memoryLimit: source.memoryLimit,
        sharedToCategory: false,
        options: {
          create: source.options.map((o) => ({
            content: o.content,
            isCorrect: o.isCorrect,
            position: o.position,
          })),
        },
        testCases: {
          create: source.testCases.map((tc) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: tc.isHidden,
            points: tc.points,
            position: tc.position,
          })),
        },
      },
      select: { id: true },
    });

    return { questionId: created.id };
  }
}
