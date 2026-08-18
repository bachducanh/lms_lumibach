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
import { visibleBankCategoryIds } from '../../common/bank/visible-categories';
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
  /** Danh mục khoá học mà một khoá được phép lấy nội dung từ đó. */
  private async visibleCategoryIds(courseCategoryId: string): Promise<string[]> {
    return visibleBankCategoryIds(this.prisma, courseCategoryId, (id) =>
      this.categories.getDescendantIds(id)
    );
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
      select: { courseId: true, bankCategoryId: true },
    });
    if (!question) throw new NotFoundException('Không tìm thấy câu hỏi');
    // Câu hỏi soạn thẳng trong ngân hàng thì đã là của chung — bật/tắt cờ chia
    // sẻ ở đây không có nghĩa gì, và courseId null sẽ lọt qua kiểm quyền khoá học.
    if (question.bankCategoryId || !question.courseId) {
      throw new ForbiddenException('Câu hỏi này vốn đã nằm trong ngân hàng của danh mục.');
    }
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
        OR: [
          // Soạn thẳng trong ngân hàng của một danh mục nhìn thấy được. Không
          // xét `sharedToCategory`: nằm trong ngân hàng ĐÃ LÀ chia sẻ rồi.
          { bankCategoryId: { in: categoryIds } },
          // Của một lớp khác và được lớp đó bật chia sẻ. Đề của chính khoá này
          // đã nằm sẵn trong kho riêng nên không kể lại.
          {
            sharedToCategory: true,
            courseId: { not: query.courseId },
            course: { deletedAt: null, categoryId: { in: categoryIds } },
          },
        ],
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
        bankCategoryId: true,
        course: { select: { id: true, name: true, categoryId: true } },
        category: { select: { name: true } },
        _count: { select: { options: true } },
      },
    });

    // Đường dẫn danh mục hay lặp lại giữa các câu — dựng một lần cho mỗi danh mục.
    const pathCache = new Map<string, string>();
    const needed = new Set<string>();
    for (const r of rows) {
      const categoryId = r.bankCategoryId ?? r.course?.categoryId;
      if (categoryId) needed.add(categoryId);
    }
    for (const categoryId of needed) {
      const breadcrumb = await this.categories.buildBreadcrumb(categoryId);
      pathCache.set(categoryId, breadcrumb.map((c) => c.name).join(' / '));
    }

    const questions: BankQuestionItem[] = rows.map((r) => {
      const categoryId = r.bankCategoryId ?? r.course?.categoryId;
      return {
        id: r.id,
        type: r.type as string,
        content: r.content,
        points: r.points,
        optionCount: r._count.options,
        createdAt: r.createdAt.toISOString(),
        sourceKind: r.bankCategoryId ? ('BANK' as const) : ('COURSE' as const),
        sourceCourseId: r.bankCategoryId ? null : (r.course?.id ?? null),
        sourceCourseName: r.bankCategoryId ? null : (r.course?.name ?? null),
        sourceCategoryPath: categoryId ? (pathCache.get(categoryId) ?? '') : '',
        sourceCategoryName: r.category?.name ?? null,
      };
    });

    return {
      questions,
      sourceCourseCount: new Set(
        questions.map((q) => q.sourceCourseId).filter((id): id is string => id !== null)
      ).size,
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
    if (!source || source.course?.deletedAt) throw new NotFoundException('Không tìm thấy câu hỏi');

    const target = await this.prisma.course.findUnique({
      where: { id: body.courseId },
      select: { categoryId: true },
    });
    if (!target) throw new NotFoundException('Khoá học không tồn tại');

    if (source.bankCategoryId) {
      // Câu hỏi của ngân hàng danh mục: chỉ cần danh mục ấy nằm trong nhánh mà
      // khoá nhận nhìn thấy. Không có "khoá nguồn" để xét quyền.
      const allowed = await this.visibleCategoryIds(target.categoryId);
      if (!allowed.includes(source.bankCategoryId)) {
        throw new ForbiddenException('Câu hỏi này không nằm trong ngân hàng của khoá học bạn chọn');
      }
    } else if (!source.course) {
      throw new NotFoundException('Không tìm thấy câu hỏi');
    } else if (!(await canManageCourse(this.prisma, user, source.course.id))) {
      // Câu hỏi của một lớp: được copy khi nó đang chia sẻ và thuộc nhánh danh
      // mục nhìn thấy được. Người vốn đã quản lý khoá nguồn thì khỏi xét — đó là
      // tự copy đề của mình sang lớp khác.
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
