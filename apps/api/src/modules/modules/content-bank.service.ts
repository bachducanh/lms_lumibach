import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaClient } from '@lumibach/db';
import type {
  ContentBankItem,
  ContentBankQuery,
  ContentBankResult,
  CopyContentBody,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';
import { canManageCourse } from '../../common/auth/course-access';
import { assertCourseScoped } from '../../common/bank/course-scoped';
import { CategoriesService } from '../categories/categories.service';
import { StorageService } from '../../common/storage/storage.service';

/**
 * Ngân hàng nội dung dùng chung theo danh mục khoá học.
 *
 * Giáo viên bật cờ chia sẻ trên một hoạt động (ModuleItem); khoá học khác cùng
 * nhánh cây danh mục nhân bản được nó về chương của mình.
 *
 * Cùng triết lý với ngân hàng câu hỏi: **nhân bản chứ không dùng chung**. Hai
 * lớp trỏ chung một bài tập thì sửa đề bên này đổi luôn đề bên kia — có khi lớp
 * đó đang làm bài dở. Bản sao khiến mỗi lớp tự chủ.
 *
 * File đính kèm cũng được nhân bản trên MinIO chứ không dùng lại cùng object:
 * hai bản ghi trỏ chung một file thì lúc xoá bản này, dịch vụ dọn file sẽ gỡ
 * object và làm hỏng luôn bản kia.
 */
@Injectable()
export class ContentBankService {
  constructor(
    private readonly prisma: PrismaClient,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly categories: CategoriesService,
    private readonly storage: StorageService
  ) {}

  /** Danh mục khoá học mà một khoá được phép lấy nội dung từ đó. */
  private async visibleCategoryIds(courseCategoryId: string): Promise<string[]> {
    const [breadcrumb, descendants] = await Promise.all([
      this.categories.buildBreadcrumb(courseCategoryId),
      this.categories.getDescendantIds(courseCategoryId),
    ]);
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

  private async invalidateModules(courseId: string): Promise<void> {
    await Promise.allSettled([
      this.cache.del(`modules:${courseId}`),
      this.cache.del(`modules:pub:${courseId}`),
      this.cache.del(`modules:nav:${courseId}`),
      this.cache.del(`modules:nav:pub:${courseId}`),
    ]);
  }

  /** Bật / tắt chia sẻ một hoạt động ra ngân hàng nội dung. */
  async setShared(
    user: AuthUser,
    moduleItemId: string,
    shared: boolean
  ): Promise<{ message: string }> {
    const item = await this.prisma.moduleItem.findUnique({
      where: { id: moduleItemId },
      select: { module: { select: { courseId: true, bankCategoryId: true } } },
    });
    if (!item) throw new NotFoundException('Không tìm thấy hoạt động');
    // Hoạt động soạn thẳng trong ngân hàng đã là của chung — bật/tắt cờ chia sẻ
    // ở đây vô nghĩa, và courseId null sẽ lọt qua kiểm quyền theo khoá học.
    if (item.module.bankCategoryId) {
      throw new ForbiddenException('Hoạt động này vốn đã nằm trong ngân hàng của danh mục.');
    }
    const courseId = assertCourseScoped(item.module.courseId, 'Hoạt động này');
    await this.assertCanManage(user, courseId);

    await this.prisma.moduleItem.update({
      where: { id: moduleItemId },
      data: { sharedToCategory: shared },
    });
    await this.invalidateModules(courseId);

    return {
      message: shared
        ? 'Đã đưa hoạt động vào ngân hàng nội dung của danh mục.'
        : 'Đã gỡ hoạt động khỏi ngân hàng nội dung.',
    };
  }

  /** Hoạt động trong ngân hàng mà khoá học này dùng được. */
  async list(user: AuthUser, query: ContentBankQuery): Promise<ContentBankResult> {
    await this.assertCanManage(user, query.courseId);

    const course = await this.prisma.course.findUnique({
      where: { id: query.courseId },
      select: { categoryId: true },
    });
    if (!course) throw new NotFoundException('Khoá học không tồn tại');

    const categoryIds = await this.visibleCategoryIds(course.categoryId);

    const rows = await this.prisma.moduleItem.findMany({
      where: {
        OR: [
          // Soạn thẳng trong ngân hàng của một danh mục nhìn thấy được. Không
          // xét `sharedToCategory`: nằm trong ngân hàng ĐÃ LÀ chia sẻ rồi.
          { module: { bankCategoryId: { in: categoryIds } } },
          // Của một lớp khác và được lớp đó bật chia sẻ. Hoạt động của chính
          // khoá này đã có sẵn nên không kể lại.
          {
            sharedToCategory: true,
            module: {
              courseId: { not: query.courseId },
              course: { deletedAt: null, categoryId: { in: categoryIds } },
            },
          },
        ],
        ...(query.type ? { type: query.type as never } : {}),
        ...(query.q ? { title: { contains: query.q, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 300,
      select: {
        id: true,
        type: true,
        title: true,
        updatedAt: true,
        lesson: { select: { estimatedMinutes: true, _count: { select: { attachments: true } } } },
        quiz: { select: { _count: { select: { questions: true } } } },
        codeExercise: { select: { language: true, _count: { select: { testCases: true } } } },
        practiceTest: { select: { _count: { select: { questions: true } } } },
        module: {
          select: {
            name: true,
            bankCategoryId: true,
            course: { select: { id: true, name: true, categoryId: true } },
          },
        },
      },
    });

    const pathCache = new Map<string, string>();
    const needed = new Set<string>();
    for (const r of rows) {
      const categoryId = r.module.bankCategoryId ?? r.module.course?.categoryId;
      if (categoryId) needed.add(categoryId);
    }
    for (const categoryId of needed) {
      const breadcrumb = await this.categories.buildBreadcrumb(categoryId);
      pathCache.set(categoryId, breadcrumb.map((c) => c.name).join(' / '));
    }

    const items: ContentBankItem[] = rows.map((r) => {
      const categoryId = r.module.bankCategoryId ?? r.module.course?.categoryId;
      return {
        moduleItemId: r.id,
        type: r.type as string,
        title: r.title,
        updatedAt: r.updatedAt.toISOString(),
        sourceKind: r.module.bankCategoryId ? ('BANK' as const) : ('COURSE' as const),
        sourceCourseId: r.module.bankCategoryId ? null : (r.module.course?.id ?? null),
        sourceCourseName: r.module.bankCategoryId ? null : (r.module.course?.name ?? null),
        sourceModuleName: r.module.name,
        sourceCategoryPath: categoryId ? (pathCache.get(categoryId) ?? '') : '',
        detail: this.describe(r),
      };
    });

    return {
      items,
      sourceCourseCount: new Set(
        items.map((i) => i.sourceCourseId).filter((id): id is string => id !== null)
      ).size,
    };
  }

  /** Một dòng mô tả ngắn cho từng loại — giúp chọn đúng thứ cần chép. */
  private describe(row: {
    type: string;
    lesson: { estimatedMinutes: number | null; _count: { attachments: number } } | null;
    quiz: { _count: { questions: number } } | null;
    codeExercise: { language: string; _count: { testCases: number } } | null;
    practiceTest: { _count: { questions: number } } | null;
  }): string {
    if (row.lesson) {
      const parts: string[] = [];
      if (row.lesson.estimatedMinutes) parts.push(`${row.lesson.estimatedMinutes} phút`);
      if (row.lesson._count.attachments) parts.push(`${row.lesson._count.attachments} đính kèm`);
      return parts.join(' · ');
    }
    if (row.quiz) return `${row.quiz._count.questions} câu hỏi`;
    if (row.codeExercise) {
      return `${row.codeExercise.language} · ${row.codeExercise._count.testCases} test case`;
    }
    if (row.practiceTest) return `${row.practiceTest._count.questions} câu`;
    return '';
  }

  /**
   * Nhân bản một hoạt động vào chương của khoá học đích.
   *
   * Ngày mở/đóng và trạng thái đăng KHÔNG được chép: lịch của mỗi lớp mỗi khác,
   * và chép sang mà tự động đăng luôn thì học sinh thấy bài chưa kịp soạn xong.
   * Bản sao luôn ở trạng thái nháp, chưa hiện với học sinh.
   */
  async copy(
    user: AuthUser,
    moduleItemId: string,
    body: CopyContentBody
  ): Promise<{ moduleItemId: string }> {
    const targetModule = await this.prisma.module.findUnique({
      where: { id: body.moduleId },
      select: { id: true, courseId: true },
    });
    if (!targetModule) throw new NotFoundException('Chương không tồn tại');
    // Đích phải là chương của một khoá học thật. Chép vào ngân hàng thì soạn
    // thẳng ở đó, không đi qua đường này.
    const courseId = assertCourseScoped(targetModule.courseId, 'Chương đích');
    await this.assertCanManage(user, courseId);

    const source = await this.prisma.moduleItem.findUnique({
      where: { id: moduleItemId },
      include: {
        lesson: { include: { attachments: true } },
        assignment: true,
        quiz: { include: { questions: { orderBy: { position: 'asc' } } } },
        codeExercise: { include: { testCases: { orderBy: { position: 'asc' } } } },
        practiceTest: { include: { questions: { orderBy: { position: 'asc' } } } },
        forum: true,
        module: {
          select: {
            courseId: true,
            bankCategoryId: true,
            course: { select: { categoryId: true } },
          },
        },
      },
    });
    if (!source) throw new NotFoundException('Không tìm thấy hoạt động');

    const target = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { categoryId: true },
    });
    if (!target) throw new NotFoundException('Khoá học không tồn tại');

    if (source.module.bankCategoryId) {
      // Nguồn là ngân hàng của danh mục: chỉ cần danh mục ấy nằm trong nhánh mà
      // khoá nhận nhìn thấy. Không có "khoá nguồn" để xét quyền.
      const allowed = await this.visibleCategoryIds(target.categoryId);
      if (!allowed.includes(source.module.bankCategoryId)) {
        throw new ForbiddenException(
          'Hoạt động này không nằm trong ngân hàng của khoá học bạn chọn'
        );
      }
    } else if (!source.module.courseId || !source.module.course) {
      throw new NotFoundException('Không tìm thấy hoạt động');
    } else if (!(await canManageCourse(this.prisma, user, source.module.courseId))) {
      // Nguồn là một lớp: được chép khi đang chia sẻ và thuộc nhánh danh mục
      // nhìn thấy được. Người vốn quản lý khoá nguồn thì khỏi xét — đó là tự
      // nhân bản bài của mình sang lớp khác.
      const allowed = await this.visibleCategoryIds(target.categoryId);
      if (!source.sharedToCategory || !allowed.includes(source.module.course.categoryId)) {
        throw new ForbiddenException(
          'Hoạt động này không nằm trong ngân hàng của khoá học bạn chọn'
        );
      }
    }

    const last = await this.prisma.moduleItem.findFirst({
      where: { moduleId: targetModule.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (last?.position ?? -1) + 1;

    const link = await this.cloneContent(user, source, courseId);

    const created = await this.prisma.moduleItem.create({
      data: {
        moduleId: targetModule.id,
        type: source.type,
        position,
        title: source.title,
        externalUrl: source.externalUrl,
        requireCompletion: source.requireCompletion,
        completionType: source.completionType,
        // Bản sao không tự chia sẻ tiếp, tránh ngân hàng đầy bản trùng.
        sharedToCategory: false,
        isPublished: false,
        ...link,
      },
      select: { id: true },
    });

    await this.invalidateModules(courseId);
    return { moduleItemId: created.id };
  }

  /** Tạo bản sao của phần nội dung, trả về khoá ngoại để gắn vào ModuleItem mới. */
  private async cloneContent(
    user: AuthUser,
    source: NonNullable<Awaited<ReturnType<ContentBankService['findSourceForClone']>>>,
    courseId: string
  ): Promise<Record<string, string>> {
    if (source.lesson) {
      const lesson = await this.prisma.lesson.create({
        data: {
          title: source.lesson.title,
          content: source.lesson.content,
          estimatedMinutes: source.lesson.estimatedMinutes,
          createdBy: user.id,
        },
        select: { id: true },
      });

      // Nhân bản từng file: dùng chung object thì xoá bài này sẽ mất file bài kia.
      for (const att of source.lesson.attachments) {
        const url = await this.storage.copyByUrl(att.url, 'lesson-files');
        if (!url) continue;
        await this.prisma.lessonAttachment.create({
          data: {
            lessonId: lesson.id,
            name: att.name,
            url,
            mimeType: att.mimeType,
            size: att.size,
            uploadedBy: user.id,
          },
        });
      }
      return { lessonId: lesson.id };
    }

    if (source.assignment) {
      const a = source.assignment;
      const created = await this.prisma.assignment.create({
        data: {
          courseId,
          title: a.title,
          instructions: a.instructions,
          type: a.type,
          status: 'DRAFT',
          maxScore: a.maxScore,
          weight: a.weight,
          latePolicy: a.latePolicy,
          latePenalty: a.latePenalty,
          allowResubmit: a.allowResubmit,
          maxAttempts: a.maxAttempts,
          maxFileSizeMb: a.maxFileSizeMb,
          maxFiles: a.maxFiles,
          // groupSubmission cần Grouping của khoá đích — không mang sang được.
          createdBy: user.id,
        },
        select: { id: true },
      });
      return { assignmentId: created.id };
    }

    if (source.quiz) {
      const q = source.quiz;
      const created = await this.prisma.quiz.create({
        data: {
          courseId,
          title: q.title,
          description: q.description,
          status: 'DRAFT',
          timeLimit: q.timeLimit,
          maxAttempts: q.maxAttempts,
          passingScore: q.passingScore,
          shuffleQuestions: q.shuffleQuestions,
          shuffleAnswers: q.shuffleAnswers,
          showResults: q.showResults,
          createdBy: user.id,
        },
        select: { id: true },
      });

      // Câu hỏi thuộc khoá nguồn — phải nhân bản sang khoá đích rồi mới nối vào
      // quiz, nếu không sửa câu hỏi ở lớp này sẽ đổi đề lớp kia.
      for (const link of q.questions) {
        const copiedId = await this.cloneQuestion(user, link.questionId, courseId);
        if (!copiedId) continue;
        await this.prisma.quizQuestion.create({
          data: {
            quizId: created.id,
            questionId: copiedId,
            position: link.position,
            points: link.points,
          },
        });
      }
      return { quizId: created.id };
    }

    if (source.codeExercise) {
      const e = source.codeExercise;
      const starterFileUrl = e.starterFileUrl
        ? await this.storage.copyByUrl(e.starterFileUrl, 'scratch')
        : null;
      const created = await this.prisma.codeExercise.create({
        data: {
          courseId,
          title: e.title,
          description: e.description,
          language: e.language,
          status: 'DRAFT',
          starterCode: e.starterCode,
          solutionCode: e.solutionCode,
          timeLimit: e.timeLimit,
          memoryLimit: e.memoryLimit,
          starterHtml: e.starterHtml,
          starterCss: e.starterCss,
          starterJs: e.starterJs,
          starterFileUrl,
          createdBy: user.id,
          testCases: {
            create: e.testCases.map((tc) => ({
              label: tc.label,
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
      return { codeExerciseId: created.id };
    }

    if (source.practiceTest) {
      const p = source.practiceTest;
      // Đề PDF là phần cốt lõi — không nhân bản được file thì huỷ luôn thao tác
      // thay vì tạo ra một đề rỗng khiến giáo viên tưởng đã chép xong.
      const pdfUrl = await this.storage.copyByUrl(p.pdfUrl, 'practice-tests');
      if (!pdfUrl) {
        throw new NotFoundException('Không sao chép được file PDF của đề — thử lại sau.');
      }
      const created = await this.prisma.practiceTest.create({
        data: {
          courseId,
          title: p.title,
          description: p.description,
          status: 'DRAFT',
          pdfUrl,
          pdfName: p.pdfName,
          pdfMimeType: p.pdfMimeType,
          pdfSize: p.pdfSize,
          timeLimit: p.timeLimit,
          maxAttempts: p.maxAttempts,
          showResults: p.showResults,
          createdBy: user.id,
          questions: {
            create: p.questions.map((q) => ({
              type: q.type,
              position: q.position,
              prompt: q.prompt,
              points: q.points,
              optionCount: q.optionCount,
              statementCount: q.statementCount,
              correctAnswer: q.correctAnswer as never,
              caseSensitive: q.caseSensitive,
            })),
          },
        },
        select: { id: true },
      });
      return { practiceTestId: created.id };
    }

    if (source.forum) {
      const created = await this.prisma.forum.create({
        data: {
          courseId,
          title: source.forum.title,
          description: source.forum.description,
        },
        select: { id: true },
      });
      // Chủ đề thảo luận là của riêng từng lớp — chỉ chép cái khung.
      return { forumId: created.id };
    }

    // FILE / EXTERNAL_URL: không có bản ghi nội dung, externalUrl đã chép ở trên.
    return {};
  }

  /** Nhân bản một câu hỏi sang khoá học khác; trả null nếu câu hỏi đã bị xoá. */
  private async cloneQuestion(
    user: AuthUser,
    questionId: string,
    courseId: string
  ): Promise<string | null> {
    const q = await this.prisma.question.findFirst({
      where: { id: questionId, deletedAt: null },
      include: {
        options: { orderBy: { position: 'asc' } },
        testCases: { orderBy: { position: 'asc' } },
      },
    });
    if (!q) return null;

    const created = await this.prisma.question.create({
      data: {
        courseId,
        type: q.type,
        content: q.content,
        explanation: q.explanation,
        points: q.points,
        createdBy: user.id,
        starterCode: q.starterCode,
        solutionCode: q.solutionCode,
        timeLimit: q.timeLimit,
        memoryLimit: q.memoryLimit,
        sharedToCategory: false,
        options: {
          create: q.options.map((o) => ({
            content: o.content,
            isCorrect: o.isCorrect,
            position: o.position,
          })),
        },
        testCases: {
          create: q.testCases.map((tc) => ({
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
    return created.id;
  }

  /** Chỉ tồn tại để lấy kiểu trả về cho cloneContent — không gọi ở đâu khác. */
  private findSourceForClone() {
    return this.prisma.moduleItem.findUnique({
      where: { id: '' },
      include: {
        lesson: { include: { attachments: true } },
        assignment: true,
        quiz: { include: { questions: true } },
        codeExercise: { include: { testCases: true } },
        practiceTest: { include: { questions: true } },
        forum: true,
        module: { select: { courseId: true, course: { select: { categoryId: true } } } },
      },
    });
  }
}
