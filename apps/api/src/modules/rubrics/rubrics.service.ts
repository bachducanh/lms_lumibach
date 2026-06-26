import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import type { AuthUser } from '../../common/auth/auth.types';
import { canManageCourse, resolveCourseAccess } from '../../common/auth/course-access';

const ROLE_ORDER = ['STUDENT', 'TA', 'TEACHER', 'ADMIN', 'SUPERADMIN'] as const;
type Role = (typeof ROLE_ORDER)[number];
function hasMinRole(r: string, min: Role) {
  return ROLE_ORDER.indexOf(r as Role) >= ROLE_ORDER.indexOf(min);
}

type CriterionInput = {
  name: string;
  description?: string | null;
  position: number;
  levels: { label: string; points: number; description?: string | null; position: number }[];
};

@Injectable()
export class RubricsService {
  constructor(private readonly prisma: PrismaClient) {}

  private async canManageAssignment(userId: string, role: string, assignmentId: string) {
    const a = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { courseId: true },
    });
    if (!a) return false;
    return canManageCourse(this.prisma, { id: userId, role }, a.courseId);
  }

  private async canManageCodeExercise(userId: string, role: string, codeExerciseId: string) {
    const ex = await this.prisma.codeExercise.findUnique({
      where: { id: codeExerciseId },
      select: { courseId: true },
    });
    if (!ex) return false;
    return canManageCourse(this.prisma, { id: userId, role }, ex.courseId);
  }

  // ── Assignment rubric ─────────────────────────────────────────

  async getAssignmentRubric(assignmentId: string) {
    return this.prisma.rubric.findUnique({
      where: { assignmentId },
      include: {
        criteria: {
          orderBy: { position: 'asc' },
          include: { levels: { orderBy: { position: 'asc' } } },
        },
      },
    });
  }

  async saveAssignmentRubric(user: AuthUser, assignmentId: string, criteria: CriterionInput[]) {
    if (!(await this.canManageAssignment(user.id, user.role, assignmentId)))
      throw new ForbiddenException('Không có quyền.');

    const rubric = await this.prisma.$transaction(async (tx) => {
      await tx.rubric.deleteMany({ where: { assignmentId } });
      return tx.rubric.create({
        data: {
          assignmentId,
          criteria: {
            create: criteria.map((c) => ({
              name: c.name,
              description: c.description ?? null,
              position: c.position,
              levels: {
                create: c.levels.map((l) => ({
                  label: l.label,
                  points: l.points,
                  description: l.description ?? null,
                  position: l.position,
                })),
              },
            })),
          },
        },
      });
    });

    return { rubricId: rubric.id };
  }

  async deleteAssignmentRubric(user: AuthUser, assignmentId: string) {
    if (!(await this.canManageAssignment(user.id, user.role, assignmentId)))
      throw new ForbiddenException('Không có quyền.');
    await this.prisma.rubric.deleteMany({ where: { assignmentId } });
    return { message: 'Đã xoá rubric.' };
  }

  // ── Code exercise rubric ──────────────────────────────────────

  async getCodeExerciseRubric(codeExerciseId: string) {
    return this.prisma.rubric.findUnique({
      where: { codeExerciseId },
      include: {
        criteria: {
          orderBy: { position: 'asc' },
          include: { levels: { orderBy: { position: 'asc' } } },
        },
      },
    });
  }

  async saveCodeExerciseRubric(user: AuthUser, codeExerciseId: string, criteria: CriterionInput[]) {
    if (!(await this.canManageCodeExercise(user.id, user.role, codeExerciseId)))
      throw new ForbiddenException('Không có quyền.');

    const rubric = await this.prisma.$transaction(async (tx) => {
      await tx.rubric.deleteMany({ where: { codeExerciseId } });
      return tx.rubric.create({
        data: {
          codeExerciseId,
          criteria: {
            create: criteria.map((c) => ({
              name: c.name,
              description: c.description ?? null,
              position: c.position,
              levels: {
                create: c.levels.map((l) => ({
                  label: l.label,
                  points: l.points,
                  description: l.description ?? null,
                  position: l.position,
                })),
              },
            })),
          },
        },
      });
    });

    return { rubricId: rubric.id };
  }

  async deleteCodeExerciseRubric(user: AuthUser, codeExerciseId: string) {
    if (!(await this.canManageCodeExercise(user.id, user.role, codeExerciseId)))
      throw new ForbiddenException('Không có quyền.');
    await this.prisma.rubric.deleteMany({ where: { codeExerciseId } });
    return { message: 'Đã xoá rubric.' };
  }

  // ── Grade with rubric ─────────────────────────────────────────

  async gradeSubmission(
    user: AuthUser,
    submissionId: string,
    selections: { criterionId: string; levelId: string }[]
  ) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');

    const sub = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { assignment: { select: { courseId: true, maxScore: true } } },
    });
    if (!sub) throw new NotFoundException('Không tìm thấy bài nộp.');

    const access = await resolveCourseAccess(this.prisma, user, sub.assignment.courseId);
    if (!access.canGrade) throw new ForbiddenException('Không có quyền.');

    const levels = await this.prisma.rubricLevel.findMany({
      where: { id: { in: selections.map((s) => s.levelId) } },
      select: { id: true, points: true },
    });
    const levelMap = new Map(levels.map((l) => [l.id, l.points]));
    const totalScore = selections.reduce((sum, s) => sum + (levelMap.get(s.levelId) ?? 0), 0);
    const score = Math.min(totalScore, sub.assignment.maxScore);

    await this.prisma.$transaction([
      ...selections.map((s) =>
        this.prisma.rubricGrade.upsert({
          where: {
            submissionId_criterionId: { submissionId, criterionId: s.criterionId },
          },
          create: {
            submissionId,
            criterionId: s.criterionId,
            levelId: s.levelId,
            gradedBy: user.id,
          },
          update: { levelId: s.levelId, gradedBy: user.id, gradedAt: new Date() },
        })
      ),
      this.prisma.submission.update({
        where: { id: submissionId },
        data: { score, status: 'GRADED', gradedAt: new Date(), gradedBy: user.id },
      }),
    ]);

    return { score, message: `Đã chấm: ${score} điểm.` };
  }

  async getSubmissionRubricGrades(user: AuthUser, submissionId: string) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');
    return this.prisma.rubricGrade.findMany({
      where: { submissionId },
      select: { criterionId: true, levelId: true },
    });
  }

  async gradeCodeSubmission(
    user: AuthUser,
    codeSubmissionId: string,
    selections: { criterionId: string; levelId: string }[],
    maxScore = 10
  ) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');

    const sub = await this.prisma.codeSubmission.findUnique({
      where: { id: codeSubmissionId },
      include: {
        codeExercise: { select: { courseId: true } },
      },
    });
    if (!sub) throw new NotFoundException('Không tìm thấy bài nộp.');
    const access = await resolveCourseAccess(this.prisma, user, sub.codeExercise.courseId);
    if (!access.canGrade) throw new ForbiddenException('Không có quyền.');

    const levels = await this.prisma.rubricLevel.findMany({
      where: { id: { in: selections.map((s) => s.levelId) } },
      select: { id: true, points: true },
    });
    const levelMap = new Map(levels.map((l) => [l.id, l.points]));
    const totalScore = selections.reduce((sum, s) => sum + (levelMap.get(s.levelId) ?? 0), 0);
    const score = Math.min(totalScore, maxScore);

    await this.prisma.$transaction([
      ...selections.map((s) =>
        this.prisma.rubricGrade.upsert({
          where: {
            codeSubmissionId_criterionId: { codeSubmissionId, criterionId: s.criterionId },
          },
          create: {
            codeSubmissionId,
            criterionId: s.criterionId,
            levelId: s.levelId,
            gradedBy: user.id,
          },
          update: { levelId: s.levelId, gradedBy: user.id, gradedAt: new Date() },
        })
      ),
      this.prisma.codeSubmission.update({
        where: { id: codeSubmissionId },
        data: { score, maxScore, status: 'ACCEPTED', gradedAt: new Date(), gradedBy: user.id },
      }),
    ]);

    return { score, message: `Đã chấm: ${score} điểm.` };
  }

  async getCodeSubmissionRubricGrades(user: AuthUser, codeSubmissionId: string) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');
    return this.prisma.rubricGrade.findMany({
      where: { codeSubmissionId },
      select: { criterionId: true, levelId: true },
    });
  }
}
