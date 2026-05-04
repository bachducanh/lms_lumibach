'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { hasMinRole } from '@/lib/permissions';
import { submitCode, waitForResult, LANGUAGE_ID } from '@/lib/judge0';
import { getCodeQueue } from '@/lib/queue';
import { logActivity } from '@/lib/activity';
import type { CodeLanguage, CodeSubmissionStatus, ExerciseStatus, UserRole } from '@prisma/client';

// ── Helpers ───────────────────────────────────────────────────

type ActionResult = { success: true; message: string } | { success: false; error: string };

const LANG_MAP: Partial<Record<CodeLanguage, number>> = {
  PYTHON3:    LANGUAGE_ID.PYTHON3,
  JAVASCRIPT: LANGUAGE_ID.JAVASCRIPT,
  CPP17:      LANGUAGE_ID.CPP17,
};

// ── Teacher: create code exercise ─────────────────────────────

type CreateExerciseInput = {
  title:    string;
  language: CodeLanguage;
  moduleId?: string;
};

export async function createExerciseAction(courseId: string, data: CreateExerciseInput) {
  const session = await auth();
  const userId  = session?.user?.id;
  const role    = session?.user?.role as UserRole | undefined;
  if (!userId || !role || !hasMinRole(role, 'TA')) return { success: false as const, error: 'Không có quyền' };

  const exercise = await prisma.codeExercise.create({
    data: {
      courseId,
      title:    data.title,
      language: data.language,
      createdBy: userId,
      // Tự động publish khi được thêm vào module (học sinh có thể truy cập ngay)
      status: data.moduleId ? 'PUBLISHED' : 'DRAFT',
    },
  });

  if (data.moduleId) {
    const last = await prisma.moduleItem.findFirst({
      where:   { moduleId: data.moduleId },
      orderBy: { position: 'desc' },
      select:  { position: true },
    });
    await prisma.moduleItem.create({
      data: {
        moduleId:       data.moduleId,
        type:           'CODE_EXERCISE',
        title:          data.title,
        codeExerciseId: exercise.id,
        position:       (last?.position ?? -1) + 1,
        isPublished:    true,
      },
    });
  }

  return { success: true as const, exerciseId: exercise.id };
}

// ── Teacher: get exercise (with test cases) ───────────────────

export async function getExerciseAction(exerciseId: string) {
  return prisma.codeExercise.findUnique({
    where:   { id: exerciseId, deletedAt: null },
    include: { testCases: { orderBy: { position: 'asc' } } },
  });
}

// ── Teacher: update exercise settings ────────────────────────

type UpdateExerciseInput = {
  title?:       string;
  description?: string;
  status?:      ExerciseStatus;
  starterCode?: string;
  solutionCode?: string;
  starterHtml?: string;
  starterCss?:  string;
  starterJs?:   string;
  timeLimit?:   number;
  memoryLimit?: number;
};

export async function updateExerciseAction(exerciseId: string, data: UpdateExerciseInput): Promise<ActionResult> {
  const session = await auth();
  const role    = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) return { success: false, error: 'Không có quyền' };

  await prisma.codeExercise.update({ where: { id: exerciseId }, data });
  return { success: true, message: 'Đã lưu cấu hình' };
}

// ── Teacher: save test cases (full replace) ───────────────────

type TCInput = { id?: string; label?: string | null; input: string; expectedOutput: string; isHidden: boolean; points: number; position: number };

export async function saveExerciseTestCasesAction(exerciseId: string, testCases: TCInput[]): Promise<ActionResult> {
  const session = await auth();
  const role    = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) return { success: false, error: 'Không có quyền' };

  await prisma.$transaction(async (tx) => {
    await tx.testCase.deleteMany({ where: { codeExerciseId: exerciseId } });
    if (testCases.length > 0) {
      await tx.testCase.createMany({
        data: testCases.map((tc, i) => ({
          codeExerciseId: exerciseId,
          label:          tc.label ?? null,
          input:          tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden:       tc.isHidden,
          points:         tc.points,
          position:       i,
        })),
      });
    }
  });
  return { success: true, message: `Đã lưu ${testCases.length} test case` };
}

// ── Student: run code (no comparison — just stdout) ──────────

export type RunCodeResult = {
  stdout:        string | null;
  stderr:        string | null;
  compileOutput: string | null;
  time:          string | null;
  memory:        number | null;
  statusDesc:    string;
};

export async function runCodeAction(
  exerciseId: string,
  code:       string,
  language:   CodeLanguage,
  stdin:      string,
): Promise<{ success: true; result: RunCodeResult } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Chưa đăng nhập' };

  const ex = await prisma.codeExercise.findUnique({ where: { id: exerciseId } });
  if (!ex) return { success: false, error: 'Bài tập không tồn tại' };

  const langId = LANG_MAP[language];
  if (!langId) return { success: false, error: 'Ngôn ngữ không hỗ trợ' };

  try {
    const token  = await submitCode({
      languageId:   langId,
      sourceCode:   code,
      stdin,
      cpuTimeLimit: ex.timeLimit,
      memoryLimit:  ex.memoryLimit,
    });
    const r = await waitForResult(token);
    return {
      success: true,
      result: {
        stdout:        r.stdout,
        stderr:        r.stderr,
        compileOutput: r.compile_output,
        time:          r.time,
        memory:        r.memory,
        statusDesc:    r.status.description,
      },
    };
  } catch {
    return { success: false, error: 'Không thể kết nối tới máy chấm. Vui lòng kiểm tra Judge0.' };
  }
}

// ── Student: submit code (queued for auto-grade) ───────────────

export async function submitExerciseAction(
  exerciseId: string,
  code: string,
  language: CodeLanguage,
): Promise<{ success: true; submissionId: string } | { success: false; error: string }> {
  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId) return { success: false, error: 'Chưa đăng nhập' };
  if (!code.trim()) return { success: false, error: 'Code trống' };

  const ex = await prisma.codeExercise.findUnique({ where: { id: exerciseId } });
  if (!ex) return { success: false, error: 'Bài tập không tồn tại' };

  const last = await prisma.codeSubmission.findFirst({
    where:   { codeExerciseId: exerciseId, studentId: userId },
    orderBy: { attemptNumber: 'desc' },
    select:  { attemptNumber: true },
  });

  // Tất cả bài tập code đều chấm thủ công — giáo viên xem code + output, tự chấm
  const sub = await prisma.codeSubmission.create({
    data: {
      codeExerciseId: exerciseId,
      studentId:      userId,
      language,
      code,
      status:         'MANUAL_REVIEW',
      attemptNumber:  (last?.attemptNumber ?? 0) + 1,
    },
  });

  logActivity({ userId, courseId: ex.courseId, action: 'SUBMIT_CODE', resourceType: 'exercise', resourceId: exerciseId, resourceName: ex.title });
  return { success: true, submissionId: sub.id };
}

// ── Poll submission status ─────────────────────────────────────

export async function getExerciseSubmissionAction(submissionId: string) {
  const session = await auth();
  const userId  = session?.user?.id;
  const role    = session?.user?.role as UserRole | undefined;
  if (!userId) return null;

  const sub = await prisma.codeSubmission.findUnique({
    where:   { id: submissionId },
    include: {
      results: {
        include: { testCase: { select: { label: true, position: true, isHidden: true, points: true } } },
        orderBy: { testCase: { position: 'asc' } },
      },
    },
  });

  if (!sub) return null;
  if (role === 'STUDENT' && sub.studentId !== userId) return null;
  return sub;
}

// ── List student's submissions for an exercise ─────────────────

export async function listMyExerciseSubmissionsAction(exerciseId: string) {
  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId) return [];
  return prisma.codeSubmission.findMany({
    where:   { codeExerciseId: exerciseId, studentId: userId },
    orderBy: { attemptNumber: 'desc' },
    select:  { id: true, status: true, score: true, maxScore: true, submittedAt: true, attemptNumber: true, language: true },
  });
}

// ── Teacher: list all submissions for an exercise ──────────────

export async function listExerciseSubmissionsAction(exerciseId: string) {
  const session = await auth();
  const role    = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) return [];

  const subs = await prisma.codeSubmission.findMany({
    where:   { codeExerciseId: exerciseId },
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true, studentId: true, status: true, score: true, maxScore: true,
      submittedAt: true, attemptNumber: true, language: true,
    },
  });

  if (subs.length === 0) return [];

  const studentIds = [...new Set(subs.map((s) => s.studentId))];
  const students   = await prisma.user.findMany({
    where:  { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true, fullName: true, email: true },
  });
  const byId = new Map(students.map((u) => [u.id, u]));

  return subs.map((s) => ({
    ...s,
    student: byId.get(s.studentId) ?? {
      id: s.studentId, firstName: '?', lastName: '?', fullName: null, email: s.studentId,
    },
  }));
}

// ── Teacher: grade a WEB submission manually ───────────────────

export async function gradeWebSubmissionAction(
  submissionId: string,
  score:        number,
  maxScore:     number,
  feedback?:    string,
): Promise<ActionResult> {
  const session = await auth();
  const userId  = session?.user?.id;
  const role    = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) return { success: false, error: 'Không có quyền' };

  await prisma.codeSubmission.update({
    where: { id: submissionId },
    data:  {
      score,
      maxScore,
      status:    'ACCEPTED',
      feedback:  feedback || null,
      gradedAt:  new Date(),
      gradedBy:  userId,
    },
  });
  return { success: true, message: 'Đã chấm điểm' };
}

// ── Teacher/Student: list exercises for assignments page ───────

export type CodeExerciseListItem = {
  id:       string;
  title:    string;
  language: CodeLanguage;
  status:   ExerciseStatus;
  _count:   { submissions: number };
};

export type ExerciseModuleGroup = {
  moduleId:   string;
  moduleName: string;
  position:   number;
  exercises:  CodeExerciseListItem[];
};

export async function listCourseExercisesByModuleAction(courseId: string): Promise<{
  groups:     ExerciseModuleGroup[];
  standalone: CodeExerciseListItem[];
}> {
  const session = await auth();
  if (!session?.user) return { groups: [], standalone: [] };
  const role    = session.user.role as UserRole;
  const isStaff = hasMinRole(role, 'TA');
  const statusFilter = isStaff ? {} : { status: 'PUBLISHED' as const };

  const [modules, exercises] = await Promise.all([
    prisma.module.findMany({
      where:   { courseId, ...(isStaff ? {} : { isPublished: true }) },
      orderBy: { position: 'asc' },
      select:  {
        id: true, name: true, position: true,
        items: {
          where:   { type: 'CODE_EXERCISE', ...(isStaff ? {} : { isPublished: true }) },
          orderBy: { position: 'asc' },
          select:  { codeExerciseId: true },
        },
      },
    }),
    prisma.codeExercise.findMany({
      where:   { courseId, deletedAt: null, ...statusFilter },
      orderBy: { createdAt: 'desc' },
      select:  {
        id: true, title: true, language: true, status: true,
        _count: { select: { submissions: true } },
      },
    }),
  ]);

  const exMap    = new Map(exercises.map((e) => [e.id, e as CodeExerciseListItem]));
  const linkedIds = new Set<string>();
  const groups: ExerciseModuleGroup[] = [];

  for (const mod of modules) {
    const modExercises: CodeExerciseListItem[] = [];
    for (const item of mod.items) {
      if (item.codeExerciseId && exMap.has(item.codeExerciseId)) {
        modExercises.push(exMap.get(item.codeExerciseId)!);
        linkedIds.add(item.codeExerciseId);
      }
    }
    if (modExercises.length > 0) {
      groups.push({ moduleId: mod.id, moduleName: mod.name, position: mod.position, exercises: modExercises });
    }
  }

  const standalone = isStaff ? exercises.filter((e) => !linkedIds.has(e.id)) : [];
  return { groups, standalone };
}

// ── Teacher: delete a student submission ───────────────────────

export async function deleteSubmissionAction(submissionId: string): Promise<ActionResult> {
  const session = await auth();
  const role    = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) return { success: false, error: 'Không có quyền' };

  const sub = await prisma.codeSubmission.findUnique({ where: { id: submissionId } });
  if (!sub) return { success: false, error: 'Không tìm thấy bài nộp' };

  await prisma.codeSubmission.delete({ where: { id: submissionId } });
  return { success: true, message: 'Đã xoá bài nộp' };
}

// ── Util ──────────────────────────────────────────────────────

function mapStatus(id: number): CodeSubmissionStatus {
  if (id === 3)  return 'ACCEPTED';
  if (id === 4)  return 'WRONG_ANSWER';
  if (id === 5)  return 'TIME_LIMIT';
  if (id === 6)  return 'COMPILE_ERROR';
  if (id >= 7 && id <= 12) return 'RUNTIME_ERROR';
  return 'INTERNAL_ERROR';
}
