import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaClient, type Prisma } from '@lumibach/db';
import type { AuthUser } from '../../common/auth/auth.types';

const ROLE_ORDER = ['STUDENT', 'TA', 'TEACHER', 'ADMIN', 'SUPERADMIN'] as const;
type Role = (typeof ROLE_ORDER)[number];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function hasMinRole(role: string, minRole: Role): boolean {
  return ROLE_ORDER.indexOf(role as Role) >= ROLE_ORDER.indexOf(minRole);
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Thang điểm chuẩn đề thi 2025 cho câu Đúng/Sai 4 ý (tỉ lệ theo điểm tối đa):
// 1 đúng = 0.1 · 2 đúng = 0.25 · 3 đúng = 0.5 · 4 đúng = 1.0 (= điểm tối đa).
const TF4_RATIOS = [0, 0.1, 0.25, 0.5, 1];

function defaultTrueFalseScores(statementCount: number, points: number): number[] {
  if (statementCount === 4) {
    return TF4_RATIOS.map((ratio) => round2(ratio * points));
  }
  return Array.from({ length: statementCount + 1 }, (_, correctCount) =>
    statementCount > 0 ? round2((correctCount / statementCount) * points) : 0
  );
}

function normalizeScoreByCorrectCount(
  value: unknown,
  statementCount: number,
  points: number
): number[] {
  const fallback = defaultTrueFalseScores(statementCount, points);
  const source = Array.isArray(value) ? value : [];
  return fallback.map((fallbackScore, correctCount) => {
    if (correctCount === 0) return 0;
    const score = Number(source[correctCount]);
    if (!Number.isFinite(score)) return fallbackScore;
    return round2(Math.min(points, Math.max(0, score)));
  });
}

function scoreTrueFalseMulti(
  answerKey: Record<string, unknown>,
  correctCount: number,
  points: number
) {
  const scores = Array.isArray(answerKey.scoreByCorrectCount) ? answerKey.scoreByCorrectCount : [];
  const configured = Number(scores[correctCount]);
  if (Number.isFinite(configured)) return round2(Math.min(points, Math.max(0, configured)));
  const statementCount = Array.isArray(answerKey.statements) ? answerKey.statements.length : 0;
  return statementCount > 0 ? round2((correctCount / statementCount) * points) : 0;
}

function asRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function jsonBoolArray(value: Prisma.JsonValue | null): (boolean | null)[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((v) => (typeof v === 'boolean' ? v : null));
}

function normalizeText(value: string, caseSensitive: boolean): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return caseSensitive ? trimmed : trimmed.toLocaleLowerCase('vi-VN');
}

function logActivity(
  prisma: PrismaClient,
  params: {
    userId: string;
    courseId?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    resourceName?: string;
  }
) {
  prisma.activityLog
    .create({ data: params as Parameters<typeof prisma.activityLog.create>[0]['data'] })
    .catch(() => {});
}

type QuestionInput = {
  type?: string;
  prompt?: string | null;
  points?: number;
  optionCount?: number;
  statementCount?: number;
  correctOption?: string | null;
  correctStatements?: boolean[];
  scoreByCorrectCount?: number[];
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
};

type PracticeTestInput = {
  courseId: string;
  title: string;
  description?: string | null;
  pdfUrl: string;
  pdfName: string;
  pdfMimeType?: string;
  pdfSize?: number;
  timeLimit?: number | null;
  maxAttempts?: number | null;
  showResults?: boolean;
  availableFrom?: string | null;
  dueDate?: string | null;
  moduleId?: string | null;
  publish?: boolean;
  questions?: QuestionInput[];
};

type AnswerInput = {
  questionId?: string;
  selectedOption?: string | null;
  statementAnswers?: (boolean | null)[];
  textAnswer?: string | null;
};

@Injectable()
export class PracticeTestsService {
  constructor(
    private readonly prisma: PrismaClient,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ) {}

  private async invalidateModuleCache(courseId: string): Promise<void> {
    await Promise.allSettled([
      this.cache.del(`modules:${courseId}`),
      this.cache.del(`modules:pub:${courseId}`),
      this.cache.del(`modules:nav:${courseId}`),
      this.cache.del(`modules:nav:pub:${courseId}`),
    ]);
  }

  private async canManage(userId: string, role: string, courseId: string) {
    if (role === 'ADMIN' || role === 'SUPERADMIN') return true;
    if (role !== 'TEACHER') return false;
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { ownerId: true },
    });
    return course?.ownerId === userId;
  }

  private normalizeQuestions(
    input: unknown
  ): Prisma.PracticeTestQuestionCreateManyPracticeTestInput[] {
    if (!Array.isArray(input) || input.length === 0) {
      throw new ForbiddenException('Cần ít nhất 1 câu trả lời.');
    }

    return input.map((raw, position) => {
      const q = (raw ?? {}) as QuestionInput;
      const type = q.type;
      const points = Math.max(0.1, Number.isFinite(q.points) ? Number(q.points) : 1);
      const base = {
        position,
        prompt: typeof q.prompt === 'string' && q.prompt.trim() ? q.prompt.trim() : null,
        points,
        caseSensitive: q.caseSensitive ?? false,
      };

      if (type === 'MULTIPLE_CHOICE') {
        const optionCount = clampInt(q.optionCount, 4, 2, 4);
        const option = (q.correctOption ?? '').trim().toUpperCase();
        if (!option || !LETTERS.slice(0, optionCount).includes(option)) {
          throw new ForbiddenException(`Câu ${position + 1} chưa có đáp án trắc nghiệm hợp lệ.`);
        }
        return {
          ...base,
          type: 'MULTIPLE_CHOICE',
          optionCount,
          statementCount: 0,
          correctAnswer: { option },
        };
      }

      if (type === 'TRUE_FALSE_MULTI') {
        const statementCount = clampInt(q.statementCount, 4, 1, 8);
        const source = Array.isArray(q.correctStatements) ? q.correctStatements : [];
        const statements = Array.from({ length: statementCount }, (_, index) =>
          typeof source[index] === 'boolean' ? source[index]! : false
        );
        const scoreByCorrectCount = normalizeScoreByCorrectCount(
          q.scoreByCorrectCount,
          statementCount,
          points
        );
        return {
          ...base,
          type: 'TRUE_FALSE_MULTI',
          optionCount: 0,
          statementCount,
          correctAnswer: { statements, scoreByCorrectCount },
        };
      }

      if (type === 'SHORT_ANSWER') {
        const answers = (Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [])
          .map((a) => String(a).trim())
          .filter(Boolean);
        if (answers.length === 0) {
          throw new ForbiddenException(`Câu ${position + 1} cần ít nhất 1 đáp án ngắn.`);
        }
        return {
          ...base,
          type: 'SHORT_ANSWER',
          optionCount: 0,
          statementCount: 0,
          correctAnswer: { answers },
        };
      }

      throw new ForbiddenException(`Loại câu ${position + 1} không hợp lệ.`);
    });
  }

  private serializeQuestion<T extends { correctAnswer: Prisma.JsonValue }>(
    question: T,
    includeAnswer: boolean
  ) {
    return {
      ...question,
      correctAnswer: includeAnswer ? asRecord(question.correctAnswer) : null,
    };
  }

  private serializeTest<T extends { questions: { correctAnswer: Prisma.JsonValue }[] }>(
    test: T,
    includeAnswers: boolean
  ) {
    return {
      ...test,
      questions: test.questions.map((q) => this.serializeQuestion(q, includeAnswers)),
    };
  }

  async listByModule(user: AuthUser, courseId: string) {
    const isStaff = hasMinRole(user.role, 'TA');
    const statusFilter = isStaff ? {} : { status: 'PUBLISHED' as const };

    const modules = await this.prisma.module.findMany({
      where: { courseId, ...(isStaff ? {} : { isPublished: true }) },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        name: true,
        position: true,
        items: {
          where: { type: 'PRACTICE_TEST', ...(isStaff ? {} : { isPublished: true }) },
          orderBy: { position: 'asc' },
          select: { practiceTestId: true },
        },
      },
    });

    const allPracticeTests = await this.prisma.practiceTest.findMany({
      where: { courseId, deletedAt: null, ...statusFilter },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        status: true,
        timeLimit: true,
        dueDate: true,
        _count: { select: { questions: true, attempts: true } },
      },
    });

    const testMap = new Map(allPracticeTests.map((test) => [test.id, test]));
    const linkedIds = new Set<string>();
    const groups = [];

    for (const mod of modules) {
      const practiceTests = [];
      for (const item of mod.items) {
        if (item.practiceTestId && testMap.has(item.practiceTestId)) {
          practiceTests.push(testMap.get(item.practiceTestId)!);
          linkedIds.add(item.practiceTestId);
        }
      }
      if (practiceTests.length > 0) {
        groups.push({
          moduleId: mod.id,
          moduleName: mod.name,
          position: mod.position,
          practiceTests,
        });
      }
    }

    return {
      groups,
      standalone: isStaff ? allPracticeTests.filter((test) => !linkedIds.has(test.id)) : [],
    };
  }

  async getById(user: AuthUser, id: string) {
    const test = await this.prisma.practiceTest.findUnique({
      where: { id, deletedAt: null },
      include: {
        questions: { orderBy: { position: 'asc' } },
        moduleItems: {
          select: { id: true, moduleId: true, module: { select: { name: true } } },
        },
        _count: { select: { questions: true, attempts: true } },
      },
    });
    if (!test) throw new NotFoundException('Không tìm thấy đề luyện tập.');

    const includeAnswers = hasMinRole(user.role, 'TA');
    if (!includeAnswers && test.status !== 'PUBLISHED') {
      throw new NotFoundException('Không tìm thấy đề luyện tập.');
    }

    return this.serializeTest(test, includeAnswers);
  }

  async getPreview(user: AuthUser, id: string) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');
    const test = await this.prisma.practiceTest.findUnique({
      where: { id, deletedAt: null },
      include: {
        questions: { orderBy: { position: 'asc' } },
        _count: { select: { questions: true, attempts: true } },
      },
    });
    if (!test) throw new NotFoundException('Không tìm thấy đề luyện tập.');
    return this.serializeTest(test, true);
  }

  async create(user: AuthUser, body: PracticeTestInput) {
    if (!(await this.canManage(user.id, user.role, body.courseId))) {
      throw new ForbiddenException('Không có quyền.');
    }

    const questions = this.normalizeQuestions(body.questions);
    if (!body.pdfUrl?.startsWith('/storage/')) {
      throw new ForbiddenException('File PDF không hợp lệ.');
    }

    const practiceTest = await this.prisma.$transaction(async (tx) => {
      const test = await tx.practiceTest.create({
        data: {
          courseId: body.courseId,
          title: body.title.trim(),
          description: body.description?.trim() || null,
          status: body.publish ? 'PUBLISHED' : 'DRAFT',
          pdfUrl: body.pdfUrl,
          pdfName: body.pdfName || 'de-bai.pdf',
          pdfMimeType: body.pdfMimeType || 'application/pdf',
          pdfSize: body.pdfSize ?? 0,
          timeLimit: body.timeLimit ?? null,
          maxAttempts: body.maxAttempts ?? null,
          showResults: body.showResults ?? true,
          availableFrom: toDate(body.availableFrom),
          dueDate: toDate(body.dueDate),
          createdBy: user.id,
          publishedAt: body.publish ? new Date() : null,
          questions: { createMany: { data: questions } },
        },
      });

      if (body.moduleId) {
        const last = await tx.moduleItem.findFirst({
          where: { moduleId: body.moduleId },
          orderBy: { position: 'desc' },
          select: { position: true },
        });
        await tx.moduleItem.create({
          data: {
            moduleId: body.moduleId,
            type: 'PRACTICE_TEST',
            position: (last?.position ?? -1) + 1,
            title: test.title,
            practiceTestId: test.id,
          },
        });
      }

      return test;
    });

    if (body.moduleId) await this.invalidateModuleCache(body.courseId);
    return { practiceTestId: practiceTest.id };
  }

  async update(user: AuthUser, id: string, body: Partial<PracticeTestInput>) {
    const existing = await this.prisma.practiceTest.findUnique({
      where: { id, deletedAt: null },
      select: { courseId: true, status: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy.');
    if (!(await this.canManage(user.id, user.role, existing.courseId))) {
      throw new ForbiddenException('Không có quyền.');
    }

    let nextStatus = existing.status;
    if (body.publish === true) nextStatus = 'PUBLISHED';
    if (body.publish === false) nextStatus = 'DRAFT';

    const questions =
      body.questions !== undefined ? this.normalizeQuestions(body.questions) : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.practiceTest.update({
        where: { id },
        data: {
          ...(body.title !== undefined && { title: body.title.trim() }),
          ...(body.description !== undefined && { description: body.description?.trim() || null }),
          ...(body.pdfUrl !== undefined && { pdfUrl: body.pdfUrl }),
          ...(body.pdfName !== undefined && { pdfName: body.pdfName }),
          ...(body.pdfMimeType !== undefined && { pdfMimeType: body.pdfMimeType }),
          ...(body.pdfSize !== undefined && { pdfSize: body.pdfSize }),
          ...(body.timeLimit !== undefined && { timeLimit: body.timeLimit ?? null }),
          ...(body.maxAttempts !== undefined && { maxAttempts: body.maxAttempts ?? null }),
          ...(body.showResults !== undefined && { showResults: body.showResults }),
          ...(body.availableFrom !== undefined && { availableFrom: toDate(body.availableFrom) }),
          ...(body.dueDate !== undefined && { dueDate: toDate(body.dueDate) }),
          status: nextStatus,
          publishedAt:
            nextStatus === 'PUBLISHED' && existing.status !== 'PUBLISHED' ? new Date() : undefined,
        },
      });

      if (body.title !== undefined) {
        await tx.moduleItem.updateMany({
          where: { practiceTestId: id },
          data: { title: body.title.trim() },
        });
      }

      if (questions) {
        await tx.practiceTestQuestion.deleteMany({ where: { practiceTestId: id } });
        await tx.practiceTestQuestion.createMany({
          data: questions.map((q) => ({ ...q, practiceTestId: id })),
        });
      }
    });

    await this.invalidateModuleCache(existing.courseId);
    return { message: 'Đã cập nhật đề luyện tập.' };
  }

  async setStatus(user: AuthUser, id: string, publish: boolean) {
    const existing = await this.prisma.practiceTest.findUnique({
      where: { id, deletedAt: null },
      select: { courseId: true, status: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy.');
    if (!(await this.canManage(user.id, user.role, existing.courseId))) {
      throw new ForbiddenException('Không có quyền.');
    }

    await this.prisma.practiceTest.update({
      where: { id },
      data: {
        status: publish ? 'PUBLISHED' : 'DRAFT',
        publishedAt: publish && existing.status !== 'PUBLISHED' ? new Date() : undefined,
      },
    });
    await this.invalidateModuleCache(existing.courseId);
    return { message: publish ? 'Đã đăng đề luyện tập.' : 'Đã chuyển về nháp.' };
  }

  async delete(user: AuthUser, id: string) {
    const existing = await this.prisma.practiceTest.findUnique({
      where: { id, deletedAt: null },
      select: { courseId: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy.');
    if (!(await this.canManage(user.id, user.role, existing.courseId))) {
      throw new ForbiddenException('Không có quyền.');
    }

    await this.prisma.$transaction([
      this.prisma.moduleItem.deleteMany({ where: { practiceTestId: id } }),
      this.prisma.practiceTest.update({ where: { id }, data: { deletedAt: new Date() } }),
    ]);
    await this.invalidateModuleCache(existing.courseId);
    return { message: 'Đã xoá đề luyện tập.' };
  }

  async listMine(user: AuthUser, practiceTestId: string) {
    return this.prisma.practiceTestAttempt.findMany({
      where: { practiceTestId, studentId: user.id },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        status: true,
        startedAt: true,
        submittedAt: true,
        score: true,
        maxScore: true,
      },
    });
  }

  async listAll(user: AuthUser, practiceTestId: string) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');
    const attempts = await this.prisma.practiceTestAttempt.findMany({
      where: { practiceTestId },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        status: true,
        startedAt: true,
        submittedAt: true,
        score: true,
        maxScore: true,
        student: {
          select: { id: true, fullName: true, firstName: true, lastName: true, email: true },
        },
        answers: {
          select: {
            questionId: true,
            statementAnswers: true,
            isCorrect: true,
            score: true,
          },
        },
      },
    });

    return attempts.map((attempt) => ({
      ...attempt,
      answers: attempt.answers.map((answer) => ({
        ...answer,
        statementAnswers: jsonBoolArray(answer.statementAnswers ?? null),
      })),
    }));
  }

  async getAttempt(user: AuthUser, attemptId: string) {
    const attempt = await this.prisma.practiceTestAttempt.findUnique({
      where: { id: attemptId },
      include: {
        student: {
          select: { id: true, fullName: true, firstName: true, lastName: true, email: true },
        },
        answers: true,
        practiceTest: {
          include: {
            questions: { orderBy: { position: 'asc' } },
            moduleItems: {
              select: { id: true, moduleId: true, module: { select: { name: true } } },
            },
            _count: { select: { questions: true, attempts: true } },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Không tìm thấy bài làm.');

    const isStaff = hasMinRole(user.role, 'TA');
    if (!isStaff && attempt.studentId !== user.id) {
      throw new ForbiddenException('Không có quyền.');
    }

    const includeAnswers = isStaff || attempt.practiceTest.showResults;
    const answerMap = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));

    return {
      ...attempt,
      practiceTest: this.serializeTest(attempt.practiceTest, includeAnswers),
      answers: attempt.practiceTest.questions.map((question) => {
        const answer = answerMap.get(question.id);
        return {
          id: answer?.id ?? '',
          questionId: question.id,
          selectedOption: answer?.selectedOption ?? null,
          statementAnswers: jsonBoolArray(answer?.statementAnswers ?? null),
          textAnswer: answer?.textAnswer ?? null,
          isCorrect: answer?.isCorrect ?? null,
          score: answer?.score ?? null,
        };
      }),
    };
  }

  async submit(user: AuthUser, practiceTestId: string, body: { answers?: AnswerInput[] }) {
    const test = await this.prisma.practiceTest.findUnique({
      where: { id: practiceTestId, deletedAt: null, status: 'PUBLISHED' },
      include: { questions: { orderBy: { position: 'asc' } } },
    });
    if (!test) throw new NotFoundException('Đề luyện tập chưa được đăng hoặc không tồn tại.');

    const now = new Date();
    if (test.availableFrom && now < test.availableFrom) throw new ForbiddenException('Đề chưa mở.');
    if (test.dueDate && now > test.dueDate) throw new ForbiddenException('Đề đã hết hạn.');

    if (test.maxAttempts) {
      const done = await this.prisma.practiceTestAttempt.count({
        where: { practiceTestId, studentId: user.id },
      });
      if (done >= test.maxAttempts) throw new ForbiddenException('Đã hết số lần làm bài.');
    }

    const answerMap = new Map(
      (Array.isArray(body.answers) ? body.answers : [])
        .filter((answer) => typeof answer.questionId === 'string')
        .map((answer) => [answer.questionId!, answer])
    );

    let totalScore = 0;
    let maxScore = 0;
    const answerRows: Prisma.PracticeTestAnswerCreateManyAttemptInput[] = [];

    for (const question of test.questions) {
      const answer = answerMap.get(question.id);
      const answerKey = asRecord(question.correctAnswer);
      const points = question.points;
      maxScore += points;

      let selectedOption: string | null = null;
      let statementAnswers: (boolean | null)[] | null = null;
      let textAnswer: string | null = null;
      let isCorrect = false;
      let score = 0;

      if (question.type === 'MULTIPLE_CHOICE') {
        const allowed = LETTERS.slice(0, question.optionCount);
        selectedOption = (answer?.selectedOption ?? '').trim().toUpperCase() || null;
        if (selectedOption && !allowed.includes(selectedOption)) selectedOption = null;
        isCorrect = selectedOption === answerKey.option;
        score = isCorrect ? points : 0;
      }

      if (question.type === 'TRUE_FALSE_MULTI') {
        const correctStatements = Array.isArray(answerKey.statements)
          ? answerKey.statements.map((v) => v === true)
          : [];
        const source = Array.isArray(answer?.statementAnswers) ? answer.statementAnswers : [];
        statementAnswers = Array.from({ length: question.statementCount }, (_, index) =>
          typeof source[index] === 'boolean' ? source[index]! : null
        );
        let correctCount = 0;
        for (let index = 0; index < question.statementCount; index++) {
          if (
            typeof statementAnswers[index] === 'boolean' &&
            statementAnswers[index] === correctStatements[index]
          ) {
            correctCount++;
          }
        }
        isCorrect = question.statementCount > 0 && correctCount === question.statementCount;
        score = scoreTrueFalseMulti(answerKey, correctCount, points);
      }

      if (question.type === 'SHORT_ANSWER') {
        const accepted = Array.isArray(answerKey.answers)
          ? answerKey.answers.map((value) => String(value))
          : [];
        textAnswer = answer?.textAnswer?.trim() || null;
        const normalizedStudent = textAnswer
          ? normalizeText(textAnswer, question.caseSensitive)
          : '';
        isCorrect =
          !!normalizedStudent &&
          accepted.some(
            (value) => normalizeText(value, question.caseSensitive) === normalizedStudent
          );
        score = isCorrect ? points : 0;
      }

      totalScore += score;
      answerRows.push({
        questionId: question.id,
        selectedOption,
        ...(statementAnswers
          ? { statementAnswers: statementAnswers as Prisma.InputJsonValue }
          : {}),
        textAnswer,
        isCorrect,
        score,
      });
    }

    const attempt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.practiceTestAttempt.create({
        data: {
          practiceTestId,
          studentId: user.id,
          status: 'GRADED',
          submittedAt: now,
          score: round2(totalScore),
          maxScore: round2(maxScore),
          answers: { createMany: { data: answerRows } },
        },
      });
      return created;
    });

    logActivity(this.prisma, {
      userId: user.id,
      courseId: test.courseId,
      action: 'SUBMIT_PRACTICE_TEST',
      resourceType: 'practice-test',
      resourceId: practiceTestId,
      resourceName: test.title,
    });

    return { attemptId: attempt.id, score: round2(totalScore), maxScore: round2(maxScore) };
  }
}
