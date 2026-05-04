'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import type { ActionResult } from '@/actions/auth';
import type { UserRole, QuizStatus } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────

export type QuizListItem = {
  id:          string;
  title:       string;
  status:      QuizStatus;
  timeLimit:   number | null;
  dueDate:     Date | null;
  _count:      { questions: number; attempts: number };
};

// ── Schema ────────────────────────────────────────────────────

const quizSchema = z.object({
  title:           z.string().min(1, 'Tiêu đề không được để trống').max(200),
  description:     z.string().optional().nullable(),
  timeLimit:       z.coerce.number().int().min(1).optional().nullable(),
  maxAttempts:     z.coerce.number().int().min(1).optional().nullable(),
  passingScore:    z.coerce.number().min(0).max(100).optional().nullable(),
  shuffleQuestions: z.boolean().default(false),
  shuffleAnswers:   z.boolean().default(false),
  showResults:      z.boolean().default(true),
  availableFrom:   z.string().optional().nullable(),
  dueDate:         z.string().optional().nullable(),
});

export type QuizFormValues = z.infer<typeof quizSchema>;

// ── Helpers ───────────────────────────────────────────────────

async function canManageCourse(userId: string, role: UserRole, courseId: string) {
  if (role === 'ADMIN') return true;
  if (role !== 'TEACHER') return false;
  const c = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
  return c?.ownerId === userId;
}

function toDate(s: string | null | undefined) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ── List question categories as banks for QuizBuilder ────────

export type QuestionBankItem = {
  id:      string;
  type:    string;
  content: string;
  points:  number;
};

export type QuizBank = {
  id:        string;
  title:     string;
  questions: QuestionBankItem[];
};

export async function listQuizBanksAction(courseId: string): Promise<QuizBank[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const cats = await (prisma as any).questionCategory.findMany({
    where:   { courseId },
    orderBy: { position: 'asc' },
    select:  {
      id: true, name: true,
      questions: {
        where:  { deletedAt: null },
        select: { id: true, type: true, content: true, points: true },
      },
    },
  });

  // Include uncategorized questions as a virtual bank (id = '__none')
  const uncategorized = await prisma.question.findMany({
    where:   { courseId, deletedAt: null, categoryId: null } as any,
    select:  { id: true, type: true, content: true, points: true },
  });

  const result: QuizBank[] = cats
    .filter((c: any) => c.questions.length > 0)
    .map((c: any) => ({ id: c.id, title: c.name, questions: c.questions }));

  if (uncategorized.length > 0) {
    result.push({ id: '__none', title: 'Chưa phân danh mục', questions: uncategorized as QuestionBankItem[] });
  }

  return result;
}

// ── List ──────────────────────────────────────────────────────

export async function listQuizzesAction(courseId: string): Promise<QuizListItem[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const role = session.user.role as UserRole;
  const isStaff = hasMinRole(role, 'TA');

  const quizzes = await prisma.quiz.findMany({
    where: {
      courseId,
      deletedAt: null,
      ...(isStaff ? {} : { status: 'PUBLISHED' }),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, title: true, status: true, timeLimit: true, dueDate: true,
      _count: { select: { questions: true, attempts: true } },
    },
  });
  return quizzes as QuizListItem[];
}

// ── List quizzes grouped by module ────────────────────────────

export type QuizModuleGroup = {
  moduleId:   string;
  moduleName: string;
  position:   number;
  quizzes:    QuizListItem[];
};

export type QuizzesByModule = {
  groups:     QuizModuleGroup[];
  standalone: QuizListItem[]; // quizzes not linked to any module
};

export async function listQuizzesByModuleAction(courseId: string): Promise<QuizzesByModule> {
  const session = await auth();
  if (!session?.user?.id) return { groups: [], standalone: [] };
  const role    = session.user.role as UserRole;
  const isStaff = hasMinRole(role, 'TA');
  const statusFilter = isStaff ? {} : { status: 'PUBLISHED' as const };

  // Get modules with their QUIZ items — học sinh chỉ thấy module/item đã publish
  const modules = await prisma.module.findMany({
    where:   { courseId, ...(isStaff ? {} : { isPublished: true }) },
    orderBy: { position: 'asc' },
    select:  {
      id: true, name: true, position: true,
      items: {
        where:   { type: 'QUIZ', ...(isStaff ? {} : { isPublished: true }) },
        orderBy: { position: 'asc' },
        select:  { quizId: true } as any,
      },
    },
  });

  // All quizzes for this course
  const allQuizzes = await prisma.quiz.findMany({
    where:   { courseId, deletedAt: null, ...statusFilter },
    orderBy: { createdAt: 'asc' },
    select:  {
      id: true, title: true, status: true, timeLimit: true, dueDate: true,
      _count: { select: { questions: true, attempts: true } },
    },
  });

  const quizMap = new Map(allQuizzes.map((q) => [q.id, q as QuizListItem]));

  // Build groups — one group per module that has ≥1 quiz item
  const linkedQuizIds = new Set<string>();
  const groups: QuizModuleGroup[] = [];

  for (const mod of modules) {
    const items = (mod.items as unknown as { quizId: string | null }[]);
    const modQuizzes: QuizListItem[] = [];
    for (const item of items) {
      if (item.quizId && quizMap.has(item.quizId)) {
        modQuizzes.push(quizMap.get(item.quizId)!);
        linkedQuizIds.add(item.quizId);
      }
    }
    if (modQuizzes.length > 0) {
      groups.push({ moduleId: mod.id, moduleName: mod.name, position: mod.position, quizzes: modQuizzes });
    }
  }

  const standalone = isStaff
    ? allQuizzes.filter((q) => !linkedQuizIds.has(q.id)) as QuizListItem[]
    : [];
  return { groups, standalone };
}

// ── Get single ────────────────────────────────────────────────

export async function getQuizAction(quizId: string) {
  return prisma.quiz.findUnique({
    where: { id: quizId, deletedAt: null },
    include: {
      questions: {
        orderBy: { position: 'asc' },
        include: {
          question: {
            include: { options: { orderBy: { position: 'asc' } } },
          },
        },
      },
      _count: { select: { attempts: true } },
    },
  });
}

// ── Get quiz for teacher preview (full question data) ─────────

export type PreviewQuizQuestion = {
  questionId: string;
  position:   number;
  points:     number;
  question: {
    id:          string;
    type:        string;
    content:     string;
    explanation: string | null;
    starterCode: string | null;
    options:     { id: string; content: string; isCorrect: boolean; position: number }[];
  };
};

export type PreviewQuizData = {
  id:               string;
  title:            string;
  description:      string | null;
  timeLimit:        number | null;
  shuffleQuestions: boolean;
  shuffleAnswers:   boolean;
  questions:        PreviewQuizQuestion[];
};

export async function getQuizPreviewAction(quizId: string): Promise<PreviewQuizData | null> {
  const session = await auth();
  const role    = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) return null;

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId, deletedAt: null },
    include: {
      questions: {
        orderBy: { position: 'asc' },
        include: {
          question: {
            include: { options: { orderBy: { position: 'asc' } } },
          },
        },
      },
    },
  });
  if (!quiz) return null;

  const questions: PreviewQuizQuestion[] = quiz.questions.map((qq) => ({
    questionId: qq.questionId,
    position:   qq.position,
    points:     qq.points ?? qq.question.points,
    question: {
      id:          qq.question.id,
      type:        qq.question.type,
      content:     qq.question.content,
      explanation: qq.question.explanation ?? null,
      starterCode: qq.question.starterCode ?? null,
      options:     qq.question.options.map((o) => ({
        id: o.id, content: o.content, isCorrect: o.isCorrect, position: o.position,
      })),
    },
  }));

  return {
    id:               quiz.id,
    title:            quiz.title,
    description:      quiz.description,
    timeLimit:        quiz.timeLimit,
    shuffleQuestions: quiz.shuffleQuestions,
    shuffleAnswers:   quiz.shuffleAnswers,
    questions,
  };
}

// ── Create ────────────────────────────────────────────────────

export async function createQuizAction(
  courseId: string,
  input: QuizFormValues,
  publish = false,
  moduleId?: string | null,
): Promise<ActionResult<{ quizId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;
  if (!(await canManageCourse(session.user.id, role, courseId))) return { success: false, error: 'Không có quyền.' };

  const parsed = quizSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Dữ liệu không hợp lệ.' };

  const d = parsed.data;
  const quiz = await prisma.quiz.create({
    data: {
      courseId,
      title:            d.title,
      description:      d.description ?? null,
      status:           publish ? 'PUBLISHED' : 'DRAFT',
      timeLimit:        d.timeLimit ?? null,
      maxAttempts:      d.maxAttempts ?? null,
      passingScore:     d.passingScore ?? null,
      shuffleQuestions: d.shuffleQuestions,
      shuffleAnswers:   d.shuffleAnswers,
      showResults:      d.showResults,
      availableFrom:    toDate(d.availableFrom),
      dueDate:          toDate(d.dueDate),
      createdBy:        session.user.id,
      publishedAt:      publish ? new Date() : null,
    },
  });

  if (moduleId) {
    const last = await prisma.moduleItem.findFirst({
      where: { moduleId }, orderBy: { position: 'desc' }, select: { position: true },
    });
    await (prisma.moduleItem as any).create({
      data: {
        moduleId,
        type: 'QUIZ',
        position: (last?.position ?? -1) + 1,
        title: d.title,
        quizId: quiz.id,
      },
    });
  }

  return { success: true, message: publish ? 'Đã đăng quiz.' : 'Đã lưu nháp.', data: { quizId: quiz.id } };
}

// ── Update ────────────────────────────────────────────────────

export async function updateQuizAction(
  quizId: string,
  input: QuizFormValues,
  publish?: boolean,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;

  const existing = await prisma.quiz.findUnique({ where: { id: quizId, deletedAt: null }, select: { courseId: true, status: true } });
  if (!existing) return { success: false, error: 'Không tìm thấy.' };
  if (!(await canManageCourse(session.user.id, role, existing.courseId))) return { success: false, error: 'Không có quyền.' };

  const parsed = quizSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Dữ liệu không hợp lệ.' };

  const d = parsed.data;
  let newStatus: QuizStatus = existing.status;
  if (publish === true)  newStatus = 'PUBLISHED';
  if (publish === false) newStatus = 'DRAFT';

  await prisma.quiz.update({
    where: { id: quizId },
    data: {
      title:            d.title,
      description:      d.description ?? null,
      status:           newStatus,
      timeLimit:        d.timeLimit ?? null,
      maxAttempts:      d.maxAttempts ?? null,
      passingScore:     d.passingScore ?? null,
      shuffleQuestions: d.shuffleQuestions,
      shuffleAnswers:   d.shuffleAnswers,
      showResults:      d.showResults,
      availableFrom:    toDate(d.availableFrom),
      dueDate:          toDate(d.dueDate),
      publishedAt:      newStatus === 'PUBLISHED' && existing.status !== 'PUBLISHED' ? new Date() : undefined,
    },
  });

  return { success: true, message: 'Đã cập nhật quiz.' };
}

// ── Toggle publish status ─────────────────────────────────────

export async function setQuizStatusAction(quizId: string, publish: boolean): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;

  const existing = await prisma.quiz.findUnique({ where: { id: quizId, deletedAt: null }, select: { courseId: true, status: true } });
  if (!existing) return { success: false, error: 'Không tìm thấy.' };
  if (!(await canManageCourse(session.user.id, role, existing.courseId))) return { success: false, error: 'Không có quyền.' };

  const newStatus: QuizStatus = publish ? 'PUBLISHED' : 'DRAFT';
  await prisma.quiz.update({
    where: { id: quizId },
    data: {
      status:      newStatus,
      publishedAt: publish && existing.status !== 'PUBLISHED' ? new Date() : undefined,
    },
  });
  return { success: true, message: publish ? 'Đã đăng quiz.' : 'Đã chuyển về nháp.' };
}

// ── Delete (soft) ─────────────────────────────────────────────

export async function deleteQuizAction(quizId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;

  const existing = await prisma.quiz.findUnique({ where: { id: quizId, deletedAt: null }, select: { courseId: true } });
  if (!existing) return { success: false, error: 'Không tìm thấy.' };
  if (!(await canManageCourse(session.user.id, role, existing.courseId))) return { success: false, error: 'Không có quyền.' };

  await prisma.quiz.update({ where: { id: quizId }, data: { deletedAt: new Date() } });
  return { success: true, message: 'Đã xoá quiz.' };
}

// ── Quiz Builder: add/remove/reorder questions ─────────────────

export async function addQuestionToQuizAction(quizId: string, questionId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId, deletedAt: null }, select: { courseId: true } });
  if (!quiz) return { success: false, error: 'Không tìm thấy quiz.' };
  if (!(await canManageCourse(session.user.id, role, quiz.courseId))) return { success: false, error: 'Không có quyền.' };

  const existing = await prisma.quizQuestion.findUnique({ where: { quizId_questionId: { quizId, questionId } } });
  if (existing) return { success: false, error: 'Câu hỏi đã có trong quiz.' };

  const last = await prisma.quizQuestion.findFirst({ where: { quizId }, orderBy: { position: 'desc' }, select: { position: true } });
  await prisma.quizQuestion.create({ data: { quizId, questionId, position: (last?.position ?? -1) + 1 } });

  return { success: true, message: 'Đã thêm câu hỏi vào quiz.' };
}

export async function removeQuestionFromQuizAction(quizId: string, questionId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId, deletedAt: null }, select: { courseId: true } });
  if (!quiz) return { success: false, error: 'Không tìm thấy quiz.' };
  if (!(await canManageCourse(session.user.id, role, quiz.courseId))) return { success: false, error: 'Không có quyền.' };

  await prisma.quizQuestion.deleteMany({ where: { quizId, questionId } });
  return { success: true, message: 'Đã xoá câu hỏi khỏi quiz.' };
}

export async function reorderQuizQuestionsAction(quizId: string, orderedIds: string[]): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId, deletedAt: null }, select: { courseId: true } });
  if (!quiz) return { success: false, error: 'Không tìm thấy quiz.' };
  if (!(await canManageCourse(session.user.id, role, quiz.courseId))) return { success: false, error: 'Không có quyền.' };

  await prisma.$transaction(
    orderedIds.map((questionId, position) =>
      prisma.quizQuestion.updateMany({ where: { quizId, questionId }, data: { position } })
    )
  );
  return { success: true, message: 'Đã cập nhật thứ tự.' };
}

export async function setQuizQuestionPointsAction(quizId: string, questionId: string, points: number | null): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId, deletedAt: null }, select: { courseId: true } });
  if (!quiz) return { success: false, error: 'Không tìm thấy quiz.' };
  if (!(await canManageCourse(session.user.id, role, quiz.courseId))) return { success: false, error: 'Không có quyền.' };

  await prisma.quizQuestion.updateMany({ where: { quizId, questionId }, data: { points } });
  return { success: true, message: 'Đã cập nhật điểm.' };
}

export async function addMultipleQuestionsToQuizAction(quizId: string, questionIds: string[]): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId, deletedAt: null }, select: { courseId: true } });
  if (!quiz) return { success: false, error: 'Không tìm thấy quiz.' };
  if (!(await canManageCourse(session.user.id, role, quiz.courseId))) return { success: false, error: 'Không có quyền.' };

  const existing = await prisma.quizQuestion.findMany({ where: { quizId }, select: { questionId: true, position: true } });
  const existingIds = new Set(existing.map((q) => q.questionId));
  const toAdd = questionIds.filter((id) => !existingIds.has(id));
  if (toAdd.length === 0) return { success: true, message: 'Không có câu hỏi mới.' };

  const lastPos = existing.reduce((m, q) => Math.max(m, q.position), -1);
  await prisma.quizQuestion.createMany({
    data: toAdd.map((questionId, i) => ({ quizId, questionId, position: lastPos + 1 + i })),
    skipDuplicates: true,
  });
  return { success: true, message: `Đã thêm ${toAdd.length} câu hỏi.` };
}

export type AddedQuizQuestion = {
  questionId: string;
  position:   number;
  points:     null;
  question: {
    type:    string;
    content: string;
    points:  number;
  };
};

export async function addRandomQuestionsToQuizAction(
  quizId: string,
  count: number,
  fromCategoryId?: string,
): Promise<ActionResult<{ added: AddedQuizQuestion[] }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId, deletedAt: null }, select: { courseId: true } });
  if (!quiz) return { success: false, error: 'Không tìm thấy quiz.' };
  if (!(await canManageCourse(session.user.id, role, quiz.courseId))) return { success: false, error: 'Không có quyền.' };

  const existing = await prisma.quizQuestion.findMany({ where: { quizId }, select: { questionId: true, position: true } });
  const existingIds = new Set(existing.map((q) => q.questionId));

  // Build category filter: '__none' = uncategorized, real id = that category, undefined = all
  let categoryFilter: Record<string, unknown>;
  if (fromCategoryId === '__none') {
    categoryFilter = { categoryId: null };
  } else if (fromCategoryId) {
    categoryFilter = { categoryId: fromCategoryId };
  } else {
    categoryFilter = {};
  }

  const all = await prisma.question.findMany({
    where: { courseId: quiz.courseId, deletedAt: null, ...categoryFilter } as any,
    select: { id: true, type: true, content: true, points: true },
  });
  const pool = all.filter((q) => !existingIds.has(q.id));

  if (pool.length === 0) return { success: false, error: 'Không còn câu hỏi nào trong danh mục này.' };

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const picked = shuffled.slice(0, Math.min(count, shuffled.length));
  const toAdd  = picked.map((q) => q.id);

  const lastPos = existing.reduce((m, q) => Math.max(m, q.position), -1);
  await prisma.quizQuestion.createMany({
    data: toAdd.map((questionId, i) => ({ quizId, questionId, position: lastPos + 1 + i })),
    skipDuplicates: true,
  });

  const added: AddedQuizQuestion[] = picked.map((q, i) => ({
    questionId: q.id,
    position:   lastPos + 1 + i,
    points:     null,
    question:   { type: q.type as string, content: q.content, points: q.points },
  }));

  return { success: true, message: `Đã thêm ${toAdd.length} câu hỏi ngẫu nhiên.`, data: { added } };
}

// ── Update quiz question points ───────────────────────────────

export async function updateQuizQuestionPointsAction(
  quizQuestionId: string,
  points: number,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;

  if (!isFinite(points) || points <= 0) return { success: false, error: 'Điểm phải lớn hơn 0.' };

  const qq = await prisma.quizQuestion.findUnique({
    where: { id: quizQuestionId },
    select: { quiz: { select: { courseId: true } } },
  });
  if (!qq) return { success: false, error: 'Không tìm thấy câu hỏi trong quiz.' };
  if (!(await canManageCourse(session.user.id, role, qq.quiz.courseId))) {
    return { success: false, error: 'Không có quyền.' };
  }

  await prisma.quizQuestion.update({
    where: { id: quizQuestionId },
    data: { points },
  });

  return { success: true, message: 'Da cap nhat diem.' };
}
