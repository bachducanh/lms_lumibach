'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import type { ActionResult } from '@/actions/auth';
import type { UserRole } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────

export type RubricLevelData = {
  id: string;
  label: string;
  points: number;
  description: string | null;
  position: number;
};

export type RubricCriterionData = {
  id: string;
  name: string;
  description: string | null;
  position: number;
  levels: RubricLevelData[];
};

export type RubricData = {
  id: string;
  assignmentId: string;
  criteria: RubricCriterionData[];
};

// ── Schema ────────────────────────────────────────────────────

const levelSchema = z.object({
  label:       z.string().min(1),
  points:      z.coerce.number().min(0),
  description: z.string().optional().nullable(),
  position:    z.number().int().default(0),
});

const criterionSchema = z.object({
  name:        z.string().min(1),
  description: z.string().optional().nullable(),
  position:    z.number().int().default(0),
  levels:      z.array(levelSchema).min(1),
});

const rubricSchema = z.object({
  criteria: z.array(criterionSchema).min(1),
});

// ── Helpers ───────────────────────────────────────────────────

async function canManageAssignment(userId: string, role: UserRole, assignmentId: string) {
  if (role === 'ADMIN') return true;
  if (role !== 'TEACHER') return false;
  const a = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: { select: { ownerId: true } } },
  });
  return a?.course.ownerId === userId;
}

// ── Get ───────────────────────────────────────────────────────

export async function getRubricAction(assignmentId: string): Promise<RubricData | null> {
  const rubric = await prisma.rubric.findUnique({
    where: { assignmentId },
    include: {
      criteria: {
        orderBy: { position: 'asc' },
        include: { levels: { orderBy: { position: 'asc' } } },
      },
    },
  });
  return rubric as RubricData | null;
}

// ── Save (upsert full rubric) ─────────────────────────────────

export async function saveRubricAction(
  assignmentId: string,
  input: { criteria: { name: string; description?: string | null; position: number; levels: { label: string; points: number; description?: string | null; position: number }[] }[] },
): Promise<ActionResult<{ rubricId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;
  if (!(await canManageAssignment(session.user.id, role, assignmentId))) {
    return { success: false, error: 'Không có quyền.' };
  }

  const parsed = rubricSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Dữ liệu rubric không hợp lệ.' };

  const rubric = await prisma.$transaction(async (tx) => {
    // Delete existing rubric (cascades to criteria → levels → grades)
    await tx.rubric.deleteMany({ where: { assignmentId } });

    return tx.rubric.create({
      data: {
        assignmentId,
        criteria: {
          create: parsed.data.criteria.map((c) => ({
            name:        c.name,
            description: c.description ?? null,
            position:    c.position,
            levels: {
              create: c.levels.map((l) => ({
                label:       l.label,
                points:      l.points,
                description: l.description ?? null,
                position:    l.position,
              })),
            },
          })),
        },
      },
    });
  });

  return { success: true, message: 'Đã lưu rubric.', data: { rubricId: rubric.id } };
}

// ── Delete ────────────────────────────────────────────────────

export async function deleteRubricAction(assignmentId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;
  if (!(await canManageAssignment(session.user.id, role, assignmentId))) {
    return { success: false, error: 'Không có quyền.' };
  }

  await prisma.rubric.deleteMany({ where: { assignmentId } });
  return { success: true, message: 'Đã xoá rubric.' };
}

// ── Grade with rubric ─────────────────────────────────────────

const gradeSchema = z.array(z.object({
  criterionId: z.string(),
  levelId:     z.string(),
}));

export async function gradeWithRubricAction(
  submissionId: string,
  selections: { criterionId: string; levelId: string }[],
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;
  if (!hasMinRole(role, 'TA')) return { success: false, error: 'Không có quyền.' };

  const parsed = gradeSchema.safeParse(selections);
  if (!parsed.success) return { success: false, error: 'Dữ liệu không hợp lệ.' };

  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { assignment: { select: { courseId: true, maxScore: true } } },
  });
  if (!sub) return { success: false, error: 'Không tìm thấy bài nộp.' };

  if (role !== 'ADMIN') {
    const course = await prisma.course.findUnique({
      where: { id: sub.assignment.courseId },
      select: { ownerId: true },
    });
    if (course?.ownerId !== session.user.id) return { success: false, error: 'Không có quyền.' };
  }

  // Validate levelIds exist and fetch points
  const levels = await prisma.rubricLevel.findMany({
    where: { id: { in: parsed.data.map((s) => s.levelId) } },
    select: { id: true, points: true },
  });
  const levelMap = new Map(levels.map((l) => [l.id, l.points]));

  const totalScore = parsed.data.reduce((sum, s) => sum + (levelMap.get(s.levelId) ?? 0), 0);
  // Cap at maxScore
  const score = Math.min(totalScore, sub.assignment.maxScore);

  await prisma.$transaction([
    // Upsert rubric grades
    ...parsed.data.map((s) =>
      prisma.rubricGrade.upsert({
        where: { submissionId_criterionId: { submissionId, criterionId: s.criterionId } },
        create: { submissionId, criterionId: s.criterionId, levelId: s.levelId, gradedBy: session!.user!.id },
        update: { levelId: s.levelId, gradedBy: session!.user!.id, gradedAt: new Date() },
      })
    ),
    // Update submission score + status
    prisma.submission.update({
      where: { id: submissionId },
      data: { score, status: 'GRADED', gradedAt: new Date(), gradedBy: session!.user!.id },
    }),
  ]);

  return { success: true, message: `Đã chấm: ${score} điểm.` };
}

// ── Get rubric grades for a submission ────────────────────────

export async function getSubmissionRubricGradesAction(submissionId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];
  const role = session.user.role as UserRole;
  if (!hasMinRole(role, 'TA')) return [];

  return prisma.rubricGrade.findMany({
    where: { submissionId },
    select: { criterionId: true, levelId: true },
  });
}
