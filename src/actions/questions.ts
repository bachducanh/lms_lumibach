'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import { runCode, LANGUAGE_ID } from '@/lib/judge0';
import type { ActionResult } from '@/actions/auth';
import type { UserRole } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────

export type QuestionOption = {
  id:        string;
  content:   string;
  isCorrect: boolean;
  position:  number;
};

export type QuestionTestCase = {
  id:             string;
  input:          string;
  expectedOutput: string;
  isHidden:       boolean;
  points:         number;
  position:       number;
};

export type QuestionItem = {
  id:           string;
  type:         string;
  content:      string;
  explanation:  string | null;
  points:       number;
  categoryId:   string | null;
  options:      QuestionOption[];
  testCases:    QuestionTestCase[];
  starterCode:  string | null;
  solutionCode: string | null;
  timeLimit:    number | null;
  memoryLimit:  number | null;
  createdAt:    Date;
};

export type QuestionCategory = {
  id:       string;
  name:     string;
  position: number;
  _count:   { questions: number };
};

export type CategoryWithQuestions = {
  id:        string;
  name:      string;
  position:  number;
  questions: QuestionItem[];
};

export type QuestionBankData = {
  categories:    CategoryWithQuestions[];
  uncategorized: QuestionItem[];
};

// ── Schema ────────────────────────────────────────────────────

const QUESTION_TYPES = [
  'MULTIPLE_CHOICE_SINGLE',
  'MULTIPLE_CHOICE_MULTIPLE',
  'TRUE_FALSE',
  'TRUE_FALSE_MULTI',
  'ESSAY',
  'CODE_PYTHON',
  'CODE_CPP',
  'CODE_WEB',
] as const;

const optionSchema = z.object({
  content:   z.string().min(1),
  isCorrect: z.boolean().default(false),
});

const testCaseSchema = z.object({
  id:             z.string().optional(),
  input:          z.string(),
  expectedOutput: z.string(),
  isHidden:       z.boolean().default(false),
  points:         z.coerce.number().min(0).default(1),
  position:       z.coerce.number().default(0),
});

const questionSchema = z.object({
  type:         z.enum(QUESTION_TYPES),
  content:      z.string().min(1, 'Nội dung câu hỏi không được để trống'),
  explanation:  z.string().optional().nullable(),
  points:       z.coerce.number().min(0).default(1),
  options:      z.array(optionSchema).optional().default([]),
  testCases:    z.array(testCaseSchema).optional().default([]),
  categoryId:   z.string().optional().nullable(),
  starterCode:  z.string().optional().nullable(),
  solutionCode: z.string().optional().nullable(),
  timeLimit:    z.coerce.number().optional().nullable(),
  memoryLimit:  z.coerce.number().optional().nullable(),
});

export type QuestionFormValues = z.infer<typeof questionSchema>;

// ── Helpers ───────────────────────────────────────────────────

async function canManageCourse(userId: string, role: UserRole, courseId: string) {
  if (role === 'ADMIN') return true;
  if (role !== 'TEACHER') return false;
  const c = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
  return c?.ownerId === userId;
}

// ── Category CRUD ─────────────────────────────────────────────

export async function listCategoriesAction(courseId: string): Promise<QuestionCategory[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const role = session.user.role as UserRole;
  if (!hasMinRole(role, 'TA')) return [];

  return (prisma as any).questionCategory.findMany({
    where:   { courseId },
    orderBy: { position: 'asc' },
    select:  { id: true, name: true, position: true, _count: { select: { questions: true } } },
  });
}

export async function createCategoryAction(
  courseId: string,
  name: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;
  if (!(await canManageCourse(session.user.id, role, courseId))) return { success: false, error: 'Không có quyền.' };

  const n = name.trim();
  if (!n) return { success: false, error: 'Tên danh mục không được để trống.' };

  const last = await (prisma as any).questionCategory.findFirst({
    where: { courseId }, orderBy: { position: 'desc' }, select: { position: true },
  });
  const position = (last?.position ?? -1) + 1;

  const cat = await (prisma as any).questionCategory.create({
    data: { courseId, name: n, position },
  });
  return { success: true, message: 'Đã tạo danh mục.', data: { id: cat.id } };
}

export async function updateCategoryAction(
  categoryId: string,
  name: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;

  const n = name.trim();
  if (!n) return { success: false, error: 'Tên không được để trống.' };

  const cat = await (prisma as any).questionCategory.findUnique({ where: { id: categoryId }, select: { courseId: true } });
  if (!cat) return { success: false, error: 'Không tìm thấy danh mục.' };
  if (!(await canManageCourse(session.user.id, role, cat.courseId))) return { success: false, error: 'Không có quyền.' };

  await (prisma as any).questionCategory.update({ where: { id: categoryId }, data: { name: n } });
  return { success: true, message: 'Đã cập nhật danh mục.' };
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;

  const cat = await (prisma as any).questionCategory.findUnique({ where: { id: categoryId }, select: { courseId: true } });
  if (!cat) return { success: false, error: 'Không tìm thấy danh mục.' };
  if (!(await canManageCourse(session.user.id, role, cat.courseId))) return { success: false, error: 'Không có quyền.' };

  await prisma.question.updateMany({ where: { categoryId } as any, data: { categoryId: null } as any });
  await (prisma as any).questionCategory.delete({ where: { id: categoryId } });
  return { success: true, message: 'Đã xoá danh mục.' };
}

// ── List questions grouped by category ───────────────────────

export async function listQuestionsByCategoryAction(courseId: string): Promise<QuestionBankData> {
  const session = await auth();
  if (!session?.user?.id) return { categories: [], uncategorized: [] };
  const role = session.user.role as UserRole;
  if (!hasMinRole(role, 'TA')) return { categories: [], uncategorized: [] };

  const [cats, allQuestions] = await Promise.all([
    (prisma as any).questionCategory.findMany({
      where:   { courseId },
      orderBy: { position: 'asc' },
      select:  {
        id: true, name: true, position: true,
        questions: {
          where:   { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            options:   { orderBy: { position: 'asc' } },
            testCases: { orderBy: { position: 'asc' } },
          },
        },
      },
    }),
    prisma.question.findMany({
      where:   { courseId, deletedAt: null, categoryId: null } as any,
      orderBy: { createdAt: 'desc' },
      include: {
        options:   { orderBy: { position: 'asc' } },
        testCases: { orderBy: { position: 'asc' } },
      },
    } as any),
  ]);

  return {
    categories:    cats as CategoryWithQuestions[],
    uncategorized: allQuestions as unknown as QuestionItem[],
  };
}

// ── Get single question ───────────────────────────────────────

export async function getQuestionAction(questionId: string): Promise<QuestionItem | null> {
  const q = await (prisma.question as any).findUnique({
    where:   { id: questionId, deletedAt: null },
    include: {
      options:   { orderBy: { position: 'asc' } },
      testCases: { orderBy: { position: 'asc' } },
    },
  });
  return q as QuestionItem | null;
}

// ── Create ────────────────────────────────────────────────────

export async function createQuestionAction(
  courseId: string,
  input: QuestionFormValues,
): Promise<ActionResult<{ questionId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;
  if (!(await canManageCourse(session.user.id, role, courseId))) return { success: false, error: 'Không có quyền.' };

  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Dữ liệu không hợp lệ.' };

  const { type, content, explanation, points, options, testCases, categoryId,
    starterCode, solutionCode, timeLimit, memoryLimit } = parsed.data;

  const question = await (prisma.question as any).create({
    data: {
      courseId,
      categoryId:  categoryId ?? null,
      type,
      content,
      explanation: explanation ?? null,
      points,
      createdBy:   session.user.id,
      starterCode:  starterCode  ?? null,
      solutionCode: solutionCode ?? null,
      timeLimit:    timeLimit    ?? null,
      memoryLimit:  memoryLimit  ?? null,
      options: {
        create: options.map((o, i) => ({ content: o.content, isCorrect: o.isCorrect, position: i })),
      },
      testCases: {
        create: testCases.map((tc, i) => ({
          input: tc.input, expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden, points: tc.points, position: i,
        })),
      },
    },
  });

  return { success: true, message: 'Đã tạo câu hỏi.', data: { questionId: question.id } };
}

// ── Update ────────────────────────────────────────────────────

export async function updateQuestionAction(
  questionId: string,
  input: QuestionFormValues,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;

  const existing = await prisma.question.findUnique({
    where: { id: questionId, deletedAt: null } as any,
    select: { courseId: true },
  });
  if (!existing) return { success: false, error: 'Không tìm thấy.' };
  if (!(await canManageCourse(session.user.id, role, existing.courseId))) return { success: false, error: 'Không có quyền.' };

  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Dữ liệu không hợp lệ.' };

  const { type, content, explanation, points, options, testCases, categoryId,
    starterCode, solutionCode, timeLimit, memoryLimit } = parsed.data;

  await (prisma as any).$transaction([
    prisma.questionOption.deleteMany({ where: { questionId } }),
    (prisma as any).questionTestCase.deleteMany({ where: { questionId } }),
    (prisma.question as any).update({
      where: { id: questionId },
      data: {
        type, content, explanation: explanation ?? null, points,
        categoryId:  categoryId  ?? null,
        starterCode:  starterCode  ?? null,
        solutionCode: solutionCode ?? null,
        timeLimit:    timeLimit    ?? null,
        memoryLimit:  memoryLimit  ?? null,
        options: {
          create: options.map((o, i) => ({ content: o.content, isCorrect: o.isCorrect, position: i })),
        },
        testCases: {
          create: testCases.map((tc, i) => ({
            input: tc.input, expectedOutput: tc.expectedOutput,
            isHidden: tc.isHidden, points: tc.points, position: i,
          })),
        },
      },
    }),
  ]);

  return { success: true, message: 'Đã cập nhật câu hỏi.' };
}

// ── Run solution code to generate expected output (teacher) ───

export async function runSolutionCodeForTCAction(
  solutionCode:  string,
  language:      'PYTHON3' | 'CPP17',
  input:         string,
  timeLimitSec:  number,
  memoryLimitKB: number,
): Promise<{ success: true; output: string } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;
  if (!hasMinRole(role, 'TA')) return { success: false, error: 'Không có quyền.' };
  if (!solutionCode.trim()) return { success: false, error: 'Code đáp án trống.' };

  const langId = language === 'PYTHON3' ? LANGUAGE_ID.PYTHON3 : LANGUAGE_ID.CPP17;
  try {
    const r = await runCode({
      languageId:   langId,
      sourceCode:   solutionCode,
      stdin:        input,
      cpuTimeLimit: timeLimitSec,
      memoryLimit:  memoryLimitKB,
    });
    if (r.status.id === 6)  return { success: false, error: `Lỗi compile:\n${r.compile_output ?? ''}` };
    if (r.status.id >= 7)   return { success: false, error: `Lỗi runtime:\n${r.stderr ?? ''}` };
    if (r.status.id === 5)  return { success: false, error: 'Quá giới hạn thời gian.' };
    return { success: true, output: r.stdout?.trimEnd() ?? '' };
  } catch {
    return { success: false, error: 'Không thể kết nối Judge0.' };
  }
}

// ── Check student's code against question test cases ──────────

export type TCCheckResult = {
  position:    number;
  isHidden:    boolean;
  passed:      boolean;
  statusId:    number;
  statusDesc:  string;
  input:       string | null;
  expected:    string | null;
  actual:      string | null;
  errorDetail: string | null;
};

export async function checkQuizCodeAction(
  questionId: string,
  code:       string,
): Promise<{ success: true; results: TCCheckResult[] } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  if (!code.trim()) return { success: false, error: 'Code trống.' };

  const question = await (prisma.question as any).findUnique({
    where:   { id: questionId, deletedAt: null },
    include: { testCases: { orderBy: { position: 'asc' } } },
  });
  if (!question) return { success: false, error: 'Không tìm thấy câu hỏi.' };
  if (question.type !== 'CODE_PYTHON' && question.type !== 'CODE_CPP') {
    return { success: false, error: 'Loại câu hỏi không hỗ trợ kiểm tra.' };
  }
  if (!question.testCases?.length) return { success: false, error: 'Câu hỏi chưa có test case.' };

  const langId = question.type === 'CODE_PYTHON' ? LANGUAGE_ID.PYTHON3 : LANGUAGE_ID.CPP17;

  const results = await Promise.all(
    (question.testCases as any[]).map(async (tc): Promise<TCCheckResult> => {
      try {
        const r = await runCode({
          languageId:   langId,
          sourceCode:   code,
          stdin:        tc.input,
          cpuTimeLimit: question.timeLimit ?? 5,
          memoryLimit:  question.memoryLimit ?? 262144,
        });
        const actual   = r.stdout?.trimEnd() ?? '';
        const passed   = r.status.id !== 6 && r.status.id < 7
          ? actual === tc.expectedOutput.trimEnd()
          : false;
        let errorDetail: string | null = null;
        if (r.status.id === 6) errorDetail = r.compile_output ?? null;
        else if (r.status.id >= 7) errorDetail = r.stderr ?? null;
        return {
          position:   tc.position,
          isHidden:   tc.isHidden,
          passed,
          statusId:   r.status.id,
          statusDesc: r.status.description,
          input:      tc.isHidden ? null : tc.input,
          expected:   tc.isHidden ? null : tc.expectedOutput,
          actual:     tc.isHidden ? null : actual,
          errorDetail,
        };
      } catch {
        return {
          position:   tc.position,
          isHidden:   tc.isHidden,
          passed:     false,
          statusId:   13,
          statusDesc: 'Internal Error',
          input:      tc.isHidden ? null : tc.input,
          expected:   tc.isHidden ? null : tc.expectedOutput,
          actual:     null,
          errorDetail: null,
        };
      }
    }),
  );

  return { success: true, results };
}

// ── Delete (soft) ─────────────────────────────────────────────

export async function deleteQuestionAction(questionId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;

  const existing = await prisma.question.findUnique({
    where: { id: questionId, deletedAt: null } as any,
    select: { courseId: true },
  });
  if (!existing) return { success: false, error: 'Không tìm thấy.' };
  if (!(await canManageCourse(session.user.id, role, existing.courseId))) return { success: false, error: 'Không có quyền.' };

  await prisma.question.update({ where: { id: questionId }, data: { deletedAt: new Date() } });
  return { success: true, message: 'Đã xoá câu hỏi.' };
}
