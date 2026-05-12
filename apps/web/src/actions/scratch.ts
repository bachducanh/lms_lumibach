'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { hasMinRole } from '@/lib/permissions';
import { logActivity } from '@/lib/activity';
import { revalidatePath } from 'next/cache';
import type { UserRole } from '@lumibach/db';

type ActionResult<T = unknown> =
  | ({ success: true; message?: string } & T)
  | { success: false; error: string };

// ── Teacher: create Scratch exercise ──────────────────────────

export async function createScratchExerciseAction(input: {
  courseId: string;
  title: string;
  description?: string;
  starterFileUrl?: string | null;
  moduleId?: string | null;
}): Promise<ActionResult<{ exerciseId: string }>> {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.role as UserRole | undefined;
  if (!userId || !role || !hasMinRole(role, 'TEACHER')) {
    return { success: false, error: 'Không có quyền.' };
  }

  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: { ownerId: true },
  });
  if (!course) return { success: false, error: 'Khoá học không tồn tại.' };
  if (role !== 'ADMIN' && course.ownerId !== userId) {
    return { success: false, error: 'Bạn không quản lý khoá học này.' };
  }
  if (!input.title.trim()) return { success: false, error: 'Tiêu đề không được để trống.' };

  const exercise = await prisma.codeExercise.create({
    data: {
      courseId: input.courseId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      language: 'SCRATCH',
      starterFileUrl: input.starterFileUrl ?? null,
      createdBy: userId,
      status: input.moduleId ? 'PUBLISHED' : 'DRAFT',
    },
  });

  if (input.moduleId) {
    const last = await prisma.moduleItem.findFirst({
      where: { moduleId: input.moduleId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    await prisma.moduleItem.create({
      data: {
        moduleId: input.moduleId,
        type: 'CODE_EXERCISE',
        title: input.title.trim(),
        codeExerciseId: exercise.id,
        position: (last?.position ?? -1) + 1,
        isPublished: true,
      },
    });
  }

  return { success: true, message: 'Đã tạo bài Scratch.', exerciseId: exercise.id };
}

// ── Teacher: update Scratch exercise ──────────────────────────

export async function updateScratchExerciseAction(input: {
  exerciseId: string;
  title?: string;
  description?: string | null;
  starterFileUrl?: string | null;
  status?: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
}): Promise<ActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.role as UserRole | undefined;
  if (!userId || !role || !hasMinRole(role, 'TEACHER')) {
    return { success: false, error: 'Không có quyền.' };
  }

  const ex = await prisma.codeExercise.findUnique({
    where: { id: input.exerciseId },
    select: { id: true, courseId: true, course: { select: { ownerId: true } } },
  });
  if (!ex) return { success: false, error: 'Bài tập không tồn tại.' };
  if (role !== 'ADMIN' && ex.course.ownerId !== userId) {
    return { success: false, error: 'Bạn không quản lý bài tập này.' };
  }

  await prisma.codeExercise.update({
    where: { id: input.exerciseId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.starterFileUrl !== undefined ? { starterFileUrl: input.starterFileUrl } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
  });

  return { success: true, message: 'Đã cập nhật.' };
}

// ── Student: submit Scratch (.sb3 already uploaded; URL passed in) ─

export async function submitScratchAction(input: {
  exerciseId: string;
  sb3Url: string;
  filename?: string;
}): Promise<ActionResult<{ submissionId: string }>> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Chưa đăng nhập.' };
  if (!input.sb3Url) return { success: false, error: 'Chưa có file .sb3.' };

  const ex = await prisma.codeExercise.findUnique({
    where: { id: input.exerciseId },
    select: { id: true, courseId: true, title: true, language: true },
  });
  if (!ex) return { success: false, error: 'Bài tập không tồn tại.' };
  if (ex.language !== 'SCRATCH') return { success: false, error: 'Bài này không phải Scratch.' };

  const last = await prisma.codeSubmission.findFirst({
    where: { codeExerciseId: input.exerciseId, studentId: userId },
    orderBy: { attemptNumber: 'desc' },
    select: { attemptNumber: true },
  });

  const sub = await prisma.codeSubmission.create({
    data: {
      codeExerciseId: input.exerciseId,
      studentId: userId,
      language: 'SCRATCH',
      code: JSON.stringify({ sb3Url: input.sb3Url, filename: input.filename ?? null }),
      status: 'MANUAL_REVIEW',
      attemptNumber: (last?.attemptNumber ?? 0) + 1,
    },
  });

  logActivity({
    userId,
    courseId: ex.courseId,
    action: 'SUBMIT_CODE',
    resourceType: 'exercise',
    resourceId: ex.id,
    resourceName: ex.title,
  });

  return { success: true, message: 'Đã nộp bài.', submissionId: sub.id };
}

// ── Teacher: grade a Scratch submission ───────────────────────

export async function gradeScratchSubmissionAction(input: {
  submissionId: string;
  score: number;
  maxScore?: number;
  feedback?: string;
}): Promise<ActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.role as UserRole | undefined;
  if (!userId || !role || !hasMinRole(role, 'TA')) {
    return { success: false, error: 'Không có quyền.' };
  }

  const sub = await prisma.codeSubmission.findUnique({
    where: { id: input.submissionId },
    select: {
      id: true,
      codeExercise: { select: { courseId: true, course: { select: { ownerId: true } } } },
    },
  });
  if (!sub) return { success: false, error: 'Submission không tồn tại.' };
  if (role === 'TEACHER' && sub.codeExercise.course.ownerId !== userId) {
    return { success: false, error: 'Bạn không quản lý khoá học này.' };
  }

  await prisma.codeSubmission.update({
    where: { id: input.submissionId },
    data: {
      score: input.score,
      maxScore: input.maxScore ?? 10,
      feedback: input.feedback?.trim() || null,
      gradedAt: new Date(),
      gradedBy: userId,
      status: 'ACCEPTED',
    },
  });

  return { success: true, message: 'Đã chấm.' };
}

// ── List my submissions for a Scratch exercise ────────────────

export async function listMyScratchSubmissionsAction(exerciseId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return [];
  return prisma.codeSubmission.findMany({
    where: { codeExerciseId: exerciseId, studentId: userId },
    orderBy: { attemptNumber: 'desc' },
    select: {
      id: true,
      status: true,
      score: true,
      maxScore: true,
      feedback: true,
      submittedAt: true,
      attemptNumber: true,
      code: true,
      gradedAt: true,
    },
  });
}

// ── List all submissions for a Scratch exercise (teacher) ─────

export async function listScratchSubmissionsAction(exerciseId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.role as UserRole | undefined;
  if (!userId || !role || !hasMinRole(role, 'TA')) return [];

  const subs = await prisma.codeSubmission.findMany({
    where: { codeExerciseId: exerciseId },
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true,
      studentId: true,
      status: true,
      score: true,
      maxScore: true,
      feedback: true,
      submittedAt: true,
      attemptNumber: true,
      code: true,
      gradedAt: true,
    },
  });

  if (subs.length === 0) return [];

  const studentIds = [...new Set(subs.map((s) => s.studentId))];
  const students = await prisma.user.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, fullName: true, firstName: true, lastName: true, avatar: true },
  });
  const byId = new Map(students.map((u) => [u.id, u]));

  return subs.map((s) => ({
    ...s,
    student: byId.get(s.studentId) ?? {
      id: s.studentId,
      fullName: null,
      firstName: '?',
      lastName: '?',
      avatar: null,
    },
  }));
}

// ── Helper: revalidate after teacher actions ──────────────────

export async function revalidateScratchExerciseAction(slug: string, exerciseId: string) {
  revalidatePath(`/courses/${slug}/scratch/${exerciseId}`);
}
