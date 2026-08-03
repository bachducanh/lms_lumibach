import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import type { AuthUser } from '../../common/auth/auth.types';
import { canManageCourse } from '../../common/auth/course-access';
import { Judge0Service, LANGUAGE_ID } from '../../common/judge0/judge0.service';
import { regradeQuizzesForQuestion } from '../../common/grading/quiz-grading';

const ROLE_ORDER = ['STUDENT', 'TA', 'TEACHER', 'ADMIN', 'SUPERADMIN'] as const;
type Role = (typeof ROLE_ORDER)[number];
function hasMinRole(r: string, min: Role) {
  return ROLE_ORDER.indexOf(r as Role) >= ROLE_ORDER.indexOf(min);
}

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly judge0: Judge0Service
  ) {}

  private async canManage(userId: string, role: string, courseId: string) {
    return canManageCourse(this.prisma, { id: userId, role }, courseId);
  }

  // ── Categories ────────────────────────────────────────────────

  async listCategories(user: AuthUser, courseId: string) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');
    return (this.prisma as any).questionCategory.findMany({
      where: { courseId },
      orderBy: { position: 'asc' },
      select: { id: true, name: true, position: true, _count: { select: { questions: true } } },
    });
  }

  async createCategory(user: AuthUser, courseId: string, name: string) {
    if (!(await this.canManage(user.id, user.role, courseId)))
      throw new ForbiddenException('Không có quyền.');

    const n = name.trim();
    if (!n) throw new ForbiddenException('Tên danh mục không được để trống.');

    const last = await (this.prisma as any).questionCategory.findFirst({
      where: { courseId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (last?.position ?? -1) + 1;
    const cat = await (this.prisma as any).questionCategory.create({
      data: { courseId, name: n, position },
    });
    return { id: cat.id };
  }

  async updateCategory(user: AuthUser, categoryId: string, name: string) {
    const n = name.trim();
    if (!n) throw new ForbiddenException('Tên không được để trống.');
    const cat = await (this.prisma as any).questionCategory.findUnique({
      where: { id: categoryId },
      select: { courseId: true },
    });
    if (!cat) throw new NotFoundException('Không tìm thấy danh mục.');
    if (!(await this.canManage(user.id, user.role, cat.courseId)))
      throw new ForbiddenException('Không có quyền.');
    await (this.prisma as any).questionCategory.update({
      where: { id: categoryId },
      data: { name: n },
    });
    return { message: 'Đã cập nhật danh mục.' };
  }

  async deleteCategory(user: AuthUser, categoryId: string) {
    const cat = await (this.prisma as any).questionCategory.findUnique({
      where: { id: categoryId },
      select: { courseId: true },
    });
    if (!cat) throw new NotFoundException('Không tìm thấy danh mục.');
    if (!(await this.canManage(user.id, user.role, cat.courseId)))
      throw new ForbiddenException('Không có quyền.');

    await this.prisma.question.updateMany({
      where: { categoryId } as any,
      data: { categoryId: null } as any,
    });
    await (this.prisma as any).questionCategory.delete({ where: { id: categoryId } });
    return { message: 'Đã xoá danh mục.' };
  }

  // ── Questions ─────────────────────────────────────────────────

  async listByCategory(user: AuthUser, courseId: string) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');

    const [cats, uncategorized] = await Promise.all([
      (this.prisma as any).questionCategory.findMany({
        where: { courseId },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          name: true,
          position: true,
          questions: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            include: {
              options: { orderBy: { position: 'asc' } },
              testCases: { orderBy: { position: 'asc' } },
            },
          },
        },
      }),
      this.prisma.question.findMany({
        where: { courseId, deletedAt: null, categoryId: null } as any,
        orderBy: { createdAt: 'desc' },
        include: {
          options: { orderBy: { position: 'asc' } },
          testCases: { orderBy: { position: 'asc' } },
        },
      } as any),
    ]);

    return { categories: cats, uncategorized };
  }

  async getById(id: string) {
    const q = await (this.prisma.question as any).findUnique({
      where: { id, deletedAt: null },
      include: {
        options: { orderBy: { position: 'asc' } },
        testCases: { orderBy: { position: 'asc' } },
      },
    });
    if (!q) throw new NotFoundException('Không tìm thấy câu hỏi.');
    return q;
  }

  async create(
    user: AuthUser,
    courseId: string,
    data: {
      type: string;
      content: string;
      explanation?: string | null;
      points?: number;
      options?: { content: string; isCorrect: boolean }[];
      testCases?: {
        input: string;
        expectedOutput: string;
        isHidden?: boolean;
        points?: number;
        position?: number;
      }[];
      categoryId?: string | null;
      starterCode?: string | null;
      solutionCode?: string | null;
      timeLimit?: number | null;
      memoryLimit?: number | null;
    }
  ) {
    if (!(await this.canManage(user.id, user.role, courseId)))
      throw new ForbiddenException('Không có quyền.');

    const question = await (this.prisma.question as any).create({
      data: {
        courseId,
        categoryId: data.categoryId ?? null,
        type: data.type,
        content: data.content,
        explanation: data.explanation ?? null,
        points: data.points ?? 1,
        createdBy: user.id,
        starterCode: data.starterCode ?? null,
        solutionCode: data.solutionCode ?? null,
        timeLimit: data.timeLimit ?? null,
        memoryLimit: data.memoryLimit ?? null,
        options: {
          create: (data.options ?? []).map((o, i) => ({
            content: o.content,
            isCorrect: o.isCorrect,
            position: i,
          })),
        },
        testCases: {
          create: (data.testCases ?? []).map((tc, i) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: tc.isHidden ?? false,
            points: tc.points ?? 1,
            position: i,
          })),
        },
      },
    });

    return { questionId: question.id };
  }

  async update(
    user: AuthUser,
    questionId: string,
    data: {
      type?: string;
      content?: string;
      explanation?: string | null;
      points?: number;
      options?: { content: string; isCorrect: boolean }[];
      testCases?: {
        input: string;
        expectedOutput: string;
        isHidden?: boolean;
        points?: number;
        position?: number;
      }[];
      categoryId?: string | null;
      starterCode?: string | null;
      solutionCode?: string | null;
      timeLimit?: number | null;
      memoryLimit?: number | null;
    }
  ) {
    const existing = await this.prisma.question.findUnique({
      where: { id: questionId, deletedAt: null } as any,
      select: { courseId: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy.');
    if (!(await this.canManage(user.id, user.role, existing.courseId)))
      throw new ForbiddenException('Không có quyền.');

    // Bài làm của học sinh (Answer.selectedOptionIds / textAnswer) tham chiếu tới
    // QuestionOption.id. Nếu xoá hết option rồi tạo lại thì id đổi hết và mọi bài
    // đã nộp mất đáp án đã chọn. Vì vậy sửa tại chỗ theo vị trí: option nào đã có
    // thì update, chỉ tạo thêm khi giáo viên thêm đáp án và chỉ xoá phần dư.
    await (this.prisma as any).$transaction(async (tx: any) => {
      await (tx.question as any).update({
        where: { id: questionId },
        data: {
          ...(data.type !== undefined && { type: data.type }),
          ...(data.content !== undefined && { content: data.content }),
          explanation: data.explanation ?? null,
          ...(data.points !== undefined && { points: data.points }),
          categoryId: data.categoryId ?? null,
          starterCode: data.starterCode ?? null,
          solutionCode: data.solutionCode ?? null,
          timeLimit: data.timeLimit ?? null,
          memoryLimit: data.memoryLimit ?? null,
        },
      });

      const nextOptions = data.options ?? [];
      const currentOptions = await tx.questionOption.findMany({
        where: { questionId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      for (let i = 0; i < nextOptions.length; i++) {
        const o = nextOptions[i]!;
        const current = currentOptions[i];
        if (current) {
          await tx.questionOption.update({
            where: { id: current.id },
            data: { content: o.content, isCorrect: o.isCorrect, position: i },
          });
        } else {
          await tx.questionOption.create({
            data: { questionId, content: o.content, isCorrect: o.isCorrect, position: i },
          });
        }
      }
      const surplusOptions = currentOptions.slice(nextOptions.length).map((o: any) => o.id);
      if (surplusOptions.length > 0) {
        await tx.questionOption.deleteMany({ where: { id: { in: surplusOptions } } });
      }

      const nextTestCases = data.testCases ?? [];
      const currentTestCases = await tx.questionTestCase.findMany({
        where: { questionId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      for (let i = 0; i < nextTestCases.length; i++) {
        const tc = nextTestCases[i]!;
        const payload = {
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden ?? false,
          points: tc.points ?? 1,
          position: i,
        };
        const current = currentTestCases[i];
        if (current) {
          await tx.questionTestCase.update({ where: { id: current.id }, data: payload });
        } else {
          await tx.questionTestCase.create({ data: { questionId, ...payload } });
        }
      }
      const surplusTestCases = currentTestCases.slice(nextTestCases.length).map((tc: any) => tc.id);
      if (surplusTestCases.length > 0) {
        await tx.questionTestCase.deleteMany({ where: { id: { in: surplusTestCases } } });
      }
    });

    // Đề/đáp án vừa đổi nên điểm đã chấm không còn đúng — chấm lại các bài đã nộp.
    const regraded = await regradeQuizzesForQuestion(this.prisma, questionId);

    return {
      message:
        regraded > 0
          ? `Đã cập nhật câu hỏi và chấm lại ${regraded} bài làm.`
          : 'Đã cập nhật câu hỏi.',
      regradedAttempts: regraded,
    };
  }

  async delete(user: AuthUser, questionId: string) {
    const existing = await this.prisma.question.findUnique({
      where: { id: questionId, deletedAt: null } as any,
      select: { courseId: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy.');
    if (!(await this.canManage(user.id, user.role, existing.courseId)))
      throw new ForbiddenException('Không có quyền.');

    await this.prisma.question.update({
      where: { id: questionId },
      data: { deletedAt: new Date() },
    });
    return { message: 'Đã xoá câu hỏi.' };
  }

  // ── Judge0 helpers ────────────────────────────────────────────

  async runSolutionCode(
    user: AuthUser,
    questionId: string,
    code: string,
    language: 'PYTHON3' | 'CPP17',
    input: string,
    timeLimitSec: number,
    memoryLimitKB: number
  ) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');
    if (!code.trim()) throw new ForbiddenException('Code đáp án trống.');

    const langId = language === 'PYTHON3' ? LANGUAGE_ID.PYTHON3 : LANGUAGE_ID.CPP17;
    const r = await this.judge0.runCode({
      languageId: langId,
      sourceCode: code,
      stdin: input,
      cpuTimeLimit: timeLimitSec,
      memoryLimit: memoryLimitKB,
    });

    if (r.status.id === 6) throw new ForbiddenException(`Lỗi compile:\n${r.compile_output ?? ''}`);
    if (r.status.id >= 7) throw new ForbiddenException(`Lỗi runtime:\n${r.stderr ?? ''}`);
    if (r.status.id === 5) throw new ForbiddenException('Quá giới hạn thời gian.');
    return { output: r.stdout?.trimEnd() ?? '' };
  }

  async checkQuizCode(user: AuthUser, questionId: string, code: string) {
    if (!code.trim()) throw new ForbiddenException('Code trống.');

    const question = await (this.prisma.question as any).findUnique({
      where: { id: questionId, deletedAt: null },
      include: { testCases: { orderBy: { position: 'asc' } } },
    });
    if (!question) throw new NotFoundException('Không tìm thấy câu hỏi.');

    const isCodeAutoType = [
      'CODE_PYTHON',
      'CODE_CPP',
      'CODE_DEBUG_PYTHON',
      'CODE_DEBUG_CPP',
    ].includes(question.type);
    if (!isCodeAutoType) throw new ForbiddenException('Loại câu hỏi không hỗ trợ kiểm tra.');
    if (!question.testCases?.length) throw new ForbiddenException('Câu hỏi chưa có test case.');

    const langId =
      question.type === 'CODE_PYTHON' || question.type === 'CODE_DEBUG_PYTHON'
        ? LANGUAGE_ID.PYTHON3
        : LANGUAGE_ID.CPP17;

    const results = await Promise.all(
      (question.testCases as any[]).map(async (tc: any) => {
        try {
          const r = await this.judge0.runCode({
            languageId: langId,
            sourceCode: code,
            stdin: tc.input,
            cpuTimeLimit: question.timeLimit ?? 5,
            memoryLimit: question.memoryLimit ?? 262144,
          });
          const actual = r.stdout?.trimEnd() ?? '';
          const passed =
            r.status.id !== 6 && r.status.id < 7 ? actual === tc.expectedOutput.trimEnd() : false;
          return {
            position: tc.position,
            isHidden: tc.isHidden,
            passed,
            statusId: r.status.id,
            statusDesc: r.status.description,
            input: tc.isHidden ? null : tc.input,
            expected: tc.isHidden ? null : tc.expectedOutput,
            actual: tc.isHidden ? null : actual,
            errorDetail:
              r.status.id === 6
                ? (r.compile_output ?? null)
                : r.status.id >= 7
                  ? (r.stderr ?? null)
                  : null,
          };
        } catch {
          return {
            position: tc.position,
            isHidden: tc.isHidden,
            passed: false,
            statusId: 13,
            statusDesc: 'Internal Error',
            input: tc.isHidden ? null : tc.input,
            expected: tc.isHidden ? null : tc.expectedOutput,
            actual: null,
            errorDetail: null,
          };
        }
      })
    );

    // Frontend (QuizPreview/QuizTaker) mong đợi mảng TCCheckResult[] trực tiếp.
    return results;
  }
}
