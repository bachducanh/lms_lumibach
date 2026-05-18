import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaClient } from '@lumibach/db';
import type { AuthUser } from '../../common/auth/auth.types';

const ROLE_ORDER = ['STUDENT', 'TA', 'TEACHER', 'ADMIN', 'SUPERADMIN'] as const;
type Role = (typeof ROLE_ORDER)[number];
function hasMinRole(r: string, min: Role) {
  return ROLE_ORDER.indexOf(r as Role) >= ROLE_ORDER.indexOf(min);
}
function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

@Injectable()
export class QuizzesService {
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
    if (role === 'ADMIN') return true;
    if (role !== 'TEACHER') return false;
    const c = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { ownerId: true },
    });
    return c?.ownerId === userId;
  }

  // ── List ──────────────────────────────────────────────────────

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
          where: { type: 'QUIZ', ...(isStaff ? {} : { isPublished: true }) },
          orderBy: { position: 'asc' },
          select: { quizId: true } as any,
        },
      },
    });

    const allQuizzes = await this.prisma.quiz.findMany({
      where: { courseId, deletedAt: null, ...statusFilter },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        status: true,
        timeLimit: true,
        dueDate: true,
        _count: { select: { questions: true, attempts: true } },
      },
    });

    const quizMap = new Map(allQuizzes.map((q) => [q.id, q]));
    const linkedIds = new Set<string>();
    const groups = [];

    for (const mod of modules) {
      const items = mod.items as unknown as { quizId: string | null }[];
      const modQuizzes = [];
      for (const item of items) {
        if (item.quizId && quizMap.has(item.quizId)) {
          modQuizzes.push(quizMap.get(item.quizId)!);
          linkedIds.add(item.quizId);
        }
      }
      if (modQuizzes.length > 0) {
        groups.push({
          moduleId: mod.id,
          moduleName: mod.name,
          position: mod.position,
          quizzes: modQuizzes,
        });
      }
    }

    const standalone = isStaff ? allQuizzes.filter((q) => !linkedIds.has(q.id)) : [];
    return { groups, standalone };
  }

  async listBanks(user: AuthUser, courseId: string) {
    const cats = await (this.prisma as any).questionCategory.findMany({
      where: { courseId },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        name: true,
        questions: {
          where: { deletedAt: null },
          select: { id: true, type: true, content: true, points: true },
        },
      },
    });

    const uncategorized = await this.prisma.question.findMany({
      where: { courseId, deletedAt: null, categoryId: null } as any,
      select: { id: true, type: true, content: true, points: true },
    });

    const result = (cats as any[])
      .filter((c: any) => c.questions.length > 0)
      .map((c: any) => ({ id: c.id, title: c.name, questions: c.questions }));

    if (uncategorized.length > 0) {
      result.push({ id: '__none', title: 'Chưa phân danh mục', questions: uncategorized });
    }

    return result;
  }

  // ── Get single ────────────────────────────────────────────────

  async getById(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id, deletedAt: null },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          include: { question: { include: { options: { orderBy: { position: 'asc' } } } } },
        },
        _count: { select: { attempts: true } },
      },
    });
    if (!quiz) throw new NotFoundException('Không tìm thấy quiz.');
    return quiz;
  }

  async getPreview(user: AuthUser, id: string) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');

    const quiz = await this.prisma.quiz.findUnique({
      where: { id, deletedAt: null },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          include: { question: { include: { options: { orderBy: { position: 'asc' } } } } },
        },
      },
    });
    if (!quiz) throw new NotFoundException('Không tìm thấy quiz.');

    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      timeLimit: quiz.timeLimit,
      shuffleQuestions: quiz.shuffleQuestions,
      shuffleAnswers: quiz.shuffleAnswers,
      questions: quiz.questions.map((qq) => ({
        questionId: qq.questionId,
        position: qq.position,
        points: qq.points ?? qq.question.points,
        question: {
          id: qq.question.id,
          type: qq.question.type,
          content: qq.question.content,
          explanation: qq.question.explanation ?? null,
          starterCode: (qq.question as any).starterCode ?? null,
          options: qq.question.options.map((o) => ({
            id: o.id,
            content: o.content,
            isCorrect: o.isCorrect,
            position: o.position,
          })),
        },
      })),
    };
  }

  // ── Create ────────────────────────────────────────────────────

  async create(
    user: AuthUser,
    body: {
      courseId: string;
      title: string;
      description?: string | null;
      timeLimit?: number | null;
      maxAttempts?: number | null;
      passingScore?: number | null;
      shuffleQuestions?: boolean;
      shuffleAnswers?: boolean;
      showResults?: boolean;
      availableFrom?: string | null;
      dueDate?: string | null;
      moduleId?: string | null;
      publish?: boolean;
    }
  ) {
    if (!(await this.canManage(user.id, user.role, body.courseId)))
      throw new ForbiddenException('Không có quyền.');

    const quiz = await this.prisma.quiz.create({
      data: {
        courseId: body.courseId,
        title: body.title,
        description: body.description ?? null,
        status: body.publish ? 'PUBLISHED' : 'DRAFT',
        timeLimit: body.timeLimit ?? null,
        maxAttempts: body.maxAttempts ?? null,
        passingScore: body.passingScore ?? null,
        shuffleQuestions: body.shuffleQuestions ?? false,
        shuffleAnswers: body.shuffleAnswers ?? false,
        showResults: body.showResults ?? true,
        availableFrom: toDate(body.availableFrom),
        dueDate: toDate(body.dueDate),
        createdBy: user.id,
        publishedAt: body.publish ? new Date() : null,
      },
    });

    if (body.moduleId) {
      const last = await this.prisma.moduleItem.findFirst({
        where: { moduleId: body.moduleId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      await (this.prisma.moduleItem as any).create({
        data: {
          moduleId: body.moduleId,
          type: 'QUIZ',
          position: (last?.position ?? -1) + 1,
          title: body.title,
          quizId: quiz.id,
        },
      });
      await this.invalidateModuleCache(body.courseId);
    }

    return { quizId: quiz.id };
  }

  // ── Update ────────────────────────────────────────────────────

  async update(
    user: AuthUser,
    id: string,
    body: {
      title?: string;
      description?: string | null;
      timeLimit?: number | null;
      maxAttempts?: number | null;
      passingScore?: number | null;
      shuffleQuestions?: boolean;
      shuffleAnswers?: boolean;
      showResults?: boolean;
      availableFrom?: string | null;
      dueDate?: string | null;
      publish?: boolean;
    }
  ) {
    const existing = await this.prisma.quiz.findUnique({
      where: { id, deletedAt: null },
      select: { courseId: true, status: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy.');
    if (!(await this.canManage(user.id, user.role, existing.courseId)))
      throw new ForbiddenException('Không có quyền.');

    let newStatus = existing.status;
    if (body.publish === true) newStatus = 'PUBLISHED';
    if (body.publish === false) newStatus = 'DRAFT';

    await this.prisma.quiz.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        description: body.description ?? null,
        status: newStatus,
        timeLimit: body.timeLimit ?? null,
        maxAttempts: body.maxAttempts ?? null,
        passingScore: body.passingScore ?? null,
        ...(body.shuffleQuestions !== undefined && { shuffleQuestions: body.shuffleQuestions }),
        ...(body.shuffleAnswers !== undefined && { shuffleAnswers: body.shuffleAnswers }),
        ...(body.showResults !== undefined && { showResults: body.showResults }),
        ...(body.availableFrom !== undefined && { availableFrom: toDate(body.availableFrom) }),
        ...(body.dueDate !== undefined && { dueDate: toDate(body.dueDate) }),
        publishedAt:
          newStatus === 'PUBLISHED' && existing.status !== 'PUBLISHED' ? new Date() : undefined,
      },
    });

    await this.invalidateModuleCache(existing.courseId);
    return { message: 'Đã cập nhật quiz.' };
  }

  async setStatus(user: AuthUser, id: string, publish: boolean) {
    const existing = await this.prisma.quiz.findUnique({
      where: { id, deletedAt: null },
      select: { courseId: true, status: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy.');
    if (!(await this.canManage(user.id, user.role, existing.courseId)))
      throw new ForbiddenException('Không có quyền.');

    await this.prisma.quiz.update({
      where: { id },
      data: {
        status: publish ? 'PUBLISHED' : 'DRAFT',
        publishedAt: publish && existing.status !== 'PUBLISHED' ? new Date() : undefined,
      },
    });
    await this.invalidateModuleCache(existing.courseId);
    return { message: publish ? 'Đã đăng quiz.' : 'Đã chuyển về nháp.' };
  }

  async delete(user: AuthUser, id: string) {
    const existing = await this.prisma.quiz.findUnique({
      where: { id, deletedAt: null },
      select: { courseId: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy.');
    if (!(await this.canManage(user.id, user.role, existing.courseId)))
      throw new ForbiddenException('Không có quyền.');

    await this.prisma.quiz.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.invalidateModuleCache(existing.courseId);
    return { message: 'Đã xoá quiz.' };
  }

  // ── Question management ───────────────────────────────────────

  async addQuestion(user: AuthUser, quizId: string, questionId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId, deletedAt: null },
      select: { courseId: true },
    });
    if (!quiz) throw new NotFoundException('Không tìm thấy quiz.');
    if (!(await this.canManage(user.id, user.role, quiz.courseId)))
      throw new ForbiddenException('Không có quyền.');

    const existing = await this.prisma.quizQuestion.findUnique({
      where: { quizId_questionId: { quizId, questionId } },
    });
    if (existing) throw new ForbiddenException('Câu hỏi đã có trong quiz.');

    const last = await this.prisma.quizQuestion.findFirst({
      where: { quizId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    await this.prisma.quizQuestion.create({
      data: { quizId, questionId, position: (last?.position ?? -1) + 1 },
    });
    return { message: 'Đã thêm câu hỏi.' };
  }

  async addMultipleQuestions(user: AuthUser, quizId: string, questionIds: string[]) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId, deletedAt: null },
      select: { courseId: true },
    });
    if (!quiz) throw new NotFoundException('Không tìm thấy quiz.');
    if (!(await this.canManage(user.id, user.role, quiz.courseId)))
      throw new ForbiddenException('Không có quyền.');

    const existing = await this.prisma.quizQuestion.findMany({
      where: { quizId },
      select: { questionId: true, position: true },
    });
    const existingIds = new Set(existing.map((q) => q.questionId));
    const toAdd = questionIds.filter((id) => !existingIds.has(id));
    if (toAdd.length === 0) return { message: 'Không có câu hỏi mới.', added: [] };

    const lastPos = existing.reduce((m, q) => Math.max(m, q.position), -1);
    await this.prisma.quizQuestion.createMany({
      data: toAdd.map((qId, i) => ({ quizId, questionId: qId, position: lastPos + 1 + i })),
      skipDuplicates: true,
    });
    return { message: `Đã thêm ${toAdd.length} câu hỏi.`, added: [] };
  }

  async addRandomQuestions(user: AuthUser, quizId: string, count: number, fromCategoryId?: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId, deletedAt: null },
      select: { courseId: true },
    });
    if (!quiz) throw new NotFoundException('Không tìm thấy quiz.');
    if (!(await this.canManage(user.id, user.role, quiz.courseId)))
      throw new ForbiddenException('Không có quyền.');

    const existing = await this.prisma.quizQuestion.findMany({
      where: { quizId },
      select: { questionId: true, position: true },
    });
    const existingIds = new Set(existing.map((q) => q.questionId));

    let categoryFilter: Record<string, unknown> = {};
    if (fromCategoryId === '__none') categoryFilter = { categoryId: null };
    else if (fromCategoryId) categoryFilter = { categoryId: fromCategoryId };

    const all = await this.prisma.question.findMany({
      where: { courseId: quiz.courseId, deletedAt: null, ...categoryFilter } as any,
      select: { id: true, type: true, content: true, points: true },
    });
    const pool = all.filter((q) => !existingIds.has(q.id));
    if (pool.length === 0) throw new ForbiddenException('Không còn câu hỏi nào.');

    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    const picked = shuffled.slice(0, Math.min(count, shuffled.length));
    const lastPos = existing.reduce((m, q) => Math.max(m, q.position), -1);
    await this.prisma.quizQuestion.createMany({
      data: picked.map((q, i) => ({ quizId, questionId: q.id, position: lastPos + 1 + i })),
      skipDuplicates: true,
    });

    const added = picked.map((q, i) => ({
      questionId: q.id,
      position: lastPos + 1 + i,
      points: null,
      question: { type: q.type, content: q.content, points: q.points },
    }));

    return { message: `Đã thêm ${picked.length} câu hỏi ngẫu nhiên.`, added };
  }

  async removeQuestion(user: AuthUser, quizId: string, questionId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId, deletedAt: null },
      select: { courseId: true },
    });
    if (!quiz) throw new NotFoundException('Không tìm thấy quiz.');
    if (!(await this.canManage(user.id, user.role, quiz.courseId)))
      throw new ForbiddenException('Không có quyền.');

    await this.prisma.quizQuestion.deleteMany({ where: { quizId, questionId } });
    return { message: 'Đã xoá câu hỏi.' };
  }

  async reorderQuestions(user: AuthUser, quizId: string, orderedIds: string[]) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId, deletedAt: null },
      select: { courseId: true },
    });
    if (!quiz) throw new NotFoundException('Không tìm thấy quiz.');
    if (!(await this.canManage(user.id, user.role, quiz.courseId)))
      throw new ForbiddenException('Không có quyền.');

    await this.prisma.$transaction(
      orderedIds.map((questionId, position) =>
        this.prisma.quizQuestion.updateMany({ where: { quizId, questionId }, data: { position } })
      )
    );
    return { message: 'Đã cập nhật thứ tự.' };
  }

  async updateQuizQuestionPoints(user: AuthUser, qqId: string, points: number) {
    if (!isFinite(points) || points <= 0) throw new ForbiddenException('Điểm phải lớn hơn 0.');

    const qq = await this.prisma.quizQuestion.findUnique({
      where: { id: qqId },
      select: { quiz: { select: { courseId: true } } },
    });
    if (!qq) throw new NotFoundException('Không tìm thấy.');
    if (!(await this.canManage(user.id, user.role, qq.quiz.courseId)))
      throw new ForbiddenException('Không có quyền.');

    await this.prisma.quizQuestion.update({ where: { id: qqId }, data: { points } });
    return { message: 'Đã cập nhật điểm.' };
  }
}
