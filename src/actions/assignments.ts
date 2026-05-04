'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { hasMinRole } from '@/lib/permissions';
import { logActivity } from '@/lib/activity';
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

export type AssignmentListItem = {
  id:           string;
  title:        string;
  type:         string;
  status:       string;
  maxScore:     number;
  dueDate:      Date | null;
  availableFrom: Date | null;
  allowResubmit: boolean;
  latePolicy:   string;
  _count:       { submissions: number };
};

export type AssignmentModuleGroup = {
  moduleId:    string;
  moduleName:  string;
  position:    number;
  assignments: AssignmentListItem[];
};

export type AssignmentsByModule = {
  groups:     AssignmentModuleGroup[];
  standalone: AssignmentListItem[];
};

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

export async function listAssignmentsByModuleAction(courseId: string): Promise<AssignmentsByModule> {
  const session = await auth();
  if (!session?.user?.id) return { groups: [], standalone: [] };

  const role    = session.user.role as UserRole;
  const isStaff = hasMinRole(role, 'TA');
  const statusFilter = isStaff ? {} : { status: 'PUBLISHED' as const };

  const modules = await prisma.module.findMany({
    where:   { courseId, ...(isStaff ? {} : { isPublished: true }) },
    orderBy: { position: 'asc' },
    select:  {
      id: true, name: true, position: true,
      items: {
        where:   { type: 'ASSIGNMENT', ...(isStaff ? {} : { isPublished: true }) },
        orderBy: { position: 'asc' },
        select:  { assignmentId: true },
      },
    },
  });

  const allAssignments = await prisma.assignment.findMany({
    where:   { courseId, deletedAt: null, ...statusFilter },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true, title: true, type: true, status: true,
      maxScore: true, dueDate: true, availableFrom: true,
      allowResubmit: true, latePolicy: true,
      _count: { select: { submissions: true } },
    },
  });

  const assignmentMap = new Map(allAssignments.map((a) => [a.id, a as AssignmentListItem]));
  const linkedIds = new Set<string>();
  const groups: AssignmentModuleGroup[] = [];

  for (const mod of modules) {
    const modAssignments: AssignmentListItem[] = [];
    for (const item of mod.items) {
      if (item.assignmentId && assignmentMap.has(item.assignmentId)) {
        modAssignments.push(assignmentMap.get(item.assignmentId)!);
        linkedIds.add(item.assignmentId);
      }
    }
    if (modAssignments.length > 0) {
      groups.push({ moduleId: mod.id, moduleName: mod.name, position: mod.position, assignments: modAssignments });
    }
  }

  // Standalone chỉ trả về cho staff; học sinh chỉ thấy items được gán vào module published
  const standalone = isStaff
    ? allAssignments.filter((a) => !linkedIds.has(a.id)) as AssignmentListItem[]
    : [];
  return { groups, standalone };
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

export async function getMySubmissionsAction(assignmentId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.submission.findMany({
    where: { assignmentId, studentId: session.user.id },
    orderBy: { attemptNumber: 'desc' },
    include: { files: { select: { id: true, name: true, url: true, size: true } } },
  });
}

export async function getSubmissionsAction(assignmentId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];
  const role = session.user.role as UserRole;
  if (!hasMinRole(role, 'TA')) return [];

  const all = await prisma.submission.findMany({
    where: { assignmentId },
    orderBy: [{ studentId: 'asc' }, { attemptNumber: 'desc' }],
    include: {
      files: { select: { id: true, name: true, url: true, mimeType: true, size: true } },
    },
  });

  // Keep only the latest attempt per student (first seen since ordered desc)
  const seen = new Set<string>();
  return all.filter((s) => {
    if (seen.has(s.studentId)) return false;
    seen.add(s.studentId);
    return true;
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
    select: { courseId: true, title: true, status: true, dueDate: true, lateDeadline: true, latePolicy: true },
  });
  if (!assignment) return { success: false, error: 'Bài tập không tồn tại.' };
  if (assignment.status !== 'PUBLISHED') return { success: false, error: 'Bài tập chưa được đăng.' };

  const existing = await prisma.submission.findFirst({
    where: { assignmentId, studentId: session.user.id },
    orderBy: { attemptNumber: 'desc' },
  });

  if (existing?.status === 'GRADED') {
    return { success: false, error: 'Bài đã được chấm. Liên hệ giáo viên để nộp lại.' };
  }

  const now = new Date();
  const isLate = assignment.dueDate ? now > assignment.dueDate : false;

  // Only block new submissions past deadline — editing existing is always allowed until graded
  if (!existing && isLate && assignment.latePolicy === 'NONE') {
    if (!assignment.lateDeadline || now > assignment.lateDeadline) {
      return { success: false, error: 'Đã hết hạn nộp bài.' };
    }
  }

  const status = asDraft ? 'DRAFT' : isLate ? 'LATE' : 'SUBMITTED';

  let sub;
  if (existing) {
    sub = await prisma.submission.update({
      where: { id: existing.id },
      data: {
        content,
        status,
        submittedAt: asDraft ? existing.submittedAt : now,
      },
    });
  } else {
    sub = await prisma.submission.create({
      data: {
        assignmentId,
        studentId: session.user.id,
        content,
        status,
        attemptNumber: 1,
        submittedAt: asDraft ? null : now,
      },
    });
  }

  if (!asDraft) {
    logActivity({ userId: session.user.id, courseId: assignment.courseId, action: 'SUBMIT_ASSIGNMENT', resourceType: 'assignment', resourceId: assignmentId, resourceName: assignment.title });
  }
  return {
    success: true,
    message: asDraft ? 'Đã lưu nháp.' : existing ? 'Đã cập nhật bài nộp.' : 'Đã nộp bài thành công!',
    data: { submissionId: sub.id },
  };
}

export async function deleteSubmissionAction(submissionId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;
  if (!hasMinRole(role, 'TA')) return { success: false, error: 'Không có quyền.' };

  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { assignment: { select: { courseId: true } } },
  });
  if (!sub) return { success: false, error: 'Không tìm thấy bài nộp.' };

  if (role !== 'ADMIN') {
    const course = await prisma.course.findUnique({
      where: { id: sub.assignment.courseId },
      select: { ownerId: true },
    });
    if (course?.ownerId !== session.user.id) return { success: false, error: 'Không có quyền.' };
  }

  await prisma.submission.delete({ where: { id: submissionId } });
  return { success: true, message: 'Đã xoá bài nộp. Học sinh có thể nộp lại.' };
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
