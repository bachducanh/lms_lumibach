'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { hasMinRole } from '@/lib/permissions';
import type { ActionResult } from '@/actions/auth';
import type { UserRole, AssignmentStatus } from '@prisma/client';

// ── Schemas ───────────────────────────────────────────────────

const assignmentSchema = z.object({
  title:         z.string().min(1, 'Tiêu đề không được để trống').max(200),
  instructions:  z.string().default(''),
  type:          z.enum(['TEXT', 'FILE', 'BOTH']).default('TEXT'),
  maxScore:      z.coerce.number().min(0).max(10000).default(100),
  weight:        z.coerce.number().min(0).max(100).default(1),
  availableFrom: z.string().optional().nullable(),
  dueDate:       z.string().optional().nullable(),
  lateDeadline:  z.string().optional().nullable(),
  latePolicy:    z.enum(['NONE', 'ALLOW', 'DEDUCT']).default('NONE'),
  latePenalty:   z.coerce.number().min(0).max(100).optional().nullable(),
  allowResubmit: z.boolean().default(false),
  maxAttempts:   z.coerce.number().int().min(1).optional().nullable(),
  moduleId:      z.string().optional().nullable(),
});

export type AssignmentFormValues = z.infer<typeof assignmentSchema>;

// ── Helpers ───────────────────────────────────────────────────

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

async function canManageCourse(userId: string, role: UserRole, courseId: string) {
  if (role === 'ADMIN') return true;
  if (role === 'TEACHER') {
    const c = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
    return c?.ownerId === userId;
  }
  return false;
}

// ── Assignment CRUD ───────────────────────────────────────────

export async function getAssignmentsAction(courseId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const role = session.user.role as UserRole;
  const isManager = role === 'ADMIN' || role === 'TEACHER' || role === 'TA';

  return prisma.assignment.findMany({
    where: {
      courseId,
      deletedAt: null,
      ...(isManager ? {} : { status: 'PUBLISHED' }),
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true, title: true, type: true, status: true,
      maxScore: true, dueDate: true, availableFrom: true,
      allowResubmit: true, latePolicy: true,
      _count: { select: { submissions: true } },
    },
  });
}

export async function getAssignmentAction(assignmentId: string) {
  return prisma.assignment.findUnique({
    where: { id: assignmentId, deletedAt: null },
    include: {
      moduleItems: { select: { id: true, moduleId: true, module: { select: { name: true } } } },
      _count: { select: { submissions: true } },
    },
  });
}

export async function createAssignmentAction(
  courseId: string,
  input: AssignmentFormValues,
  publish = false,
): Promise<ActionResult<{ assignmentId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  if (!(await canManageCourse(session.user.id, session.user.role as UserRole, courseId))) return { success: false, error: 'Không có quyền.' };

  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Dữ liệu không hợp lệ.' };

  const { moduleId, ...data } = parsed.data;

  const assignment = await prisma.$transaction(async (tx) => {
    const a = await tx.assignment.create({
      data: {
        courseId,
        title:         data.title,
        instructions:  data.instructions,
        type:          data.type,
        status:        publish ? 'PUBLISHED' : 'DRAFT',
        maxScore:      data.maxScore,
        weight:        data.weight,
        availableFrom: toDate(data.availableFrom),
        dueDate:       toDate(data.dueDate),
        lateDeadline:  toDate(data.lateDeadline),
        latePolicy:    data.latePolicy,
        latePenalty:   data.latePenalty ?? null,
        allowResubmit: data.allowResubmit,
        maxAttempts:   data.maxAttempts ?? null,
        createdBy:     session!.user!.id,
        publishedAt:   publish ? new Date() : null,
      },
    });

    if (moduleId) {
      const last = await tx.moduleItem.findFirst({
        where: { moduleId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      await tx.moduleItem.create({
        data: {
          moduleId,
          type: 'ASSIGNMENT',
          position: (last?.position ?? -1) + 1,
          title: a.title,
          assignmentId: a.id,
        },
      });
    }

    return a;
  });

  return { success: true, message: publish ? 'Đã đăng bài tập.' : 'Đã lưu nháp.', data: { assignmentId: assignment.id } };
}

export async function updateAssignmentAction(
  assignmentId: string,
  input: AssignmentFormValues,
  publish?: boolean,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };

  const existing = await prisma.assignment.findUnique({ where: { id: assignmentId, deletedAt: null }, select: { courseId: true, status: true } });
  if (!existing) return { success: false, error: 'Không tìm thấy.' };
  if (!(await canManageCourse(session.user.id, session.user.role as UserRole, existing.courseId))) return { success: false, error: 'Không có quyền.' };

  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Dữ liệu không hợp lệ.' };

  const { moduleId: _moduleId, ...data } = parsed.data;

  let newStatus: AssignmentStatus = existing.status;
  if (publish === true)  newStatus = 'PUBLISHED';
  if (publish === false) newStatus = 'DRAFT';

  await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      title:         data.title,
      instructions:  data.instructions,
      type:          data.type,
      status:        newStatus,
      maxScore:      data.maxScore,
      weight:        data.weight,
      availableFrom: toDate(data.availableFrom),
      dueDate:       toDate(data.dueDate),
      lateDeadline:  toDate(data.lateDeadline),
      latePolicy:    data.latePolicy,
      latePenalty:   data.latePenalty ?? null,
      allowResubmit: data.allowResubmit,
      maxAttempts:   data.maxAttempts ?? null,
      publishedAt:   newStatus === 'PUBLISHED' && existing.status !== 'PUBLISHED' ? new Date() : undefined,
    },
  });

  return { success: true, message: 'Đã cập nhật bài tập.' };
}

export async function deleteAssignmentAction(assignmentId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };

  const existing = await prisma.assignment.findUnique({ where: { id: assignmentId, deletedAt: null }, select: { courseId: true } });
  if (!existing) return { success: false, error: 'Không tìm thấy.' };
  if (!(await canManageCourse(session.user.id, session.user.role as UserRole, existing.courseId))) return { success: false, error: 'Không có quyền.' };

  await prisma.assignment.update({ where: { id: assignmentId }, data: { deletedAt: new Date() } });
  return { success: true, message: 'Đã xóa bài tập.' };
}

// ── Submission ────────────────────────────────────────────────

export async function getMySubmissionAction(assignmentId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  return prisma.submission.findFirst({
    where: { assignmentId, studentId: session.user.id },
    orderBy: { attemptNumber: 'desc' },
    include: { files: true },
  });
}

export async function getSubmissionsAction(assignmentId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];
  const role = session.user.role as UserRole;
  if (!hasMinRole(role, 'TA')) return [];

  return prisma.submission.findMany({
    where: { assignmentId },
    orderBy: { submittedAt: 'desc' },
    include: {
      files: { select: { id: true, name: true, url: true, mimeType: true, size: true } },
    },
  });
}

export async function submitAssignmentAction(
  assignmentId: string,
  content: string,
  asDraft = false,
): Promise<ActionResult<{ submissionId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId, deletedAt: null },
    select: { status: true, allowResubmit: true, maxAttempts: true, dueDate: true, lateDeadline: true, latePolicy: true },
  });
  if (!assignment) return { success: false, error: 'Bài tập không tồn tại.' };
  if (assignment.status !== 'PUBLISHED') return { success: false, error: 'Bài tập chưa được đăng.' };

  const now = new Date();
  const isLate = assignment.dueDate ? now > assignment.dueDate : false;
  if (isLate && assignment.latePolicy === 'NONE') {
    if (!assignment.lateDeadline || now > assignment.lateDeadline) {
      return { success: false, error: 'Đã hết hạn nộp bài.' };
    }
  }

  const existing = await prisma.submission.findFirst({
    where: { assignmentId, studentId: session.user.id },
    orderBy: { attemptNumber: 'desc' },
  });

  if (existing && existing.status !== 'DRAFT' && !assignment.allowResubmit) {
    return { success: false, error: 'Bài tập không cho phép nộp lại.' };
  }

  const attemptNumber = existing?.status === 'DRAFT' ? existing.attemptNumber : (existing?.attemptNumber ?? 0) + 1;

  if (assignment.maxAttempts && attemptNumber > assignment.maxAttempts) {
    return { success: false, error: `Đã hết số lần nộp (tối đa ${assignment.maxAttempts}).` };
  }

  const status = asDraft ? 'DRAFT' : isLate ? 'LATE' : 'SUBMITTED';

  const sub = await prisma.submission.upsert({
    where: {
      assignmentId_studentId_attemptNumber: {
        assignmentId,
        studentId: session.user.id,
        attemptNumber,
      },
    },
    create: {
      assignmentId,
      studentId: session.user.id,
      content,
      status,
      attemptNumber,
      submittedAt: asDraft ? null : now,
    },
    update: {
      content,
      status,
      submittedAt: asDraft ? undefined : now,
    },
  });

  return {
    success: true,
    message: asDraft ? 'Đã lưu nháp.' : 'Đã nộp bài thành công!',
    data: { submissionId: sub.id },
  };
}

export async function gradeSubmissionAction(
  submissionId: string,
  score: number,
  feedback: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;
  if (!hasMinRole(role, 'TA')) return { success: false, error: 'Không có quyền.' };

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      score,
      feedback,
      status: 'GRADED',
      gradedAt: new Date(),
      gradedBy: session.user.id,
    },
  });

  return { success: true, message: 'Đã lưu điểm.' };
}
