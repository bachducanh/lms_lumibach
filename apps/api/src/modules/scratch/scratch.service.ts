import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import type { AuthUser } from '../../common/auth/auth.types';

const ROLE_ORDER = ['STUDENT', 'TA', 'TEACHER', 'ADMIN', 'SUPERADMIN'] as const;
type Role = (typeof ROLE_ORDER)[number];
function hasMinRole(r: string, min: Role) {
  return ROLE_ORDER.indexOf(r as Role) >= ROLE_ORDER.indexOf(min);
}

@Injectable()
export class ScratchService {
  private readonly prisma = new PrismaClient();

  async create(
    user: AuthUser,
    body: {
      courseId: string;
      title: string;
      description?: string | null;
      starterFileUrl?: string | null;
      moduleId?: string | null;
    }
  ) {
    if (!hasMinRole(user.role, 'TEACHER')) throw new ForbiddenException('Không có quyền.');

    const course = await this.prisma.course.findUnique({
      where: { id: body.courseId },
      select: { ownerId: true },
    });
    if (!course) throw new NotFoundException('Khoá học không tồn tại.');
    if (user.role !== 'ADMIN' && course.ownerId !== user.id)
      throw new ForbiddenException('Bạn không quản lý khoá học này.');

    const exercise = await this.prisma.codeExercise.create({
      data: {
        courseId: body.courseId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        language: 'SCRATCH',
        starterFileUrl: body.starterFileUrl ?? null,
        createdBy: user.id,
        status: body.moduleId ? 'PUBLISHED' : 'DRAFT',
      },
    });

    if (body.moduleId) {
      const last = await this.prisma.moduleItem.findFirst({
        where: { moduleId: body.moduleId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      await this.prisma.moduleItem.create({
        data: {
          moduleId: body.moduleId,
          type: 'CODE_EXERCISE',
          title: body.title.trim(),
          codeExerciseId: exercise.id,
          position: (last?.position ?? -1) + 1,
          isPublished: true,
        },
      });
    }

    return { exerciseId: exercise.id };
  }

  async update(
    user: AuthUser,
    exerciseId: string,
    body: {
      title?: string;
      description?: string | null;
      starterFileUrl?: string | null;
      status?: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
    }
  ) {
    if (!hasMinRole(user.role, 'TEACHER')) throw new ForbiddenException('Không có quyền.');

    const ex = await this.prisma.codeExercise.findUnique({
      where: { id: exerciseId },
      select: { id: true, course: { select: { ownerId: true } } },
    });
    if (!ex) throw new NotFoundException('Bài tập không tồn tại.');
    if (user.role !== 'ADMIN' && ex.course.ownerId !== user.id)
      throw new ForbiddenException('Bạn không quản lý bài tập này.');

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title.trim();
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.starterFileUrl !== undefined) data.starterFileUrl = body.starterFileUrl;
    if (body.status) data.status = body.status;

    await this.prisma.codeExercise.update({ where: { id: exerciseId }, data });
    return { message: 'Đã cập nhật.' };
  }

  async submit(user: AuthUser, exerciseId: string, body: { sb3Url: string; filename?: string }) {
    if (!body.sb3Url) throw new NotFoundException('Thiếu file .sb3.');

    const ex = await this.prisma.codeExercise.findUnique({
      where: { id: exerciseId },
      select: { id: true, courseId: true, title: true, language: true },
    });
    if (!ex) throw new NotFoundException('Bài tập không tồn tại.');

    const last = await this.prisma.codeSubmission.findFirst({
      where: { codeExerciseId: exerciseId, studentId: user.id },
      orderBy: { attemptNumber: 'desc' },
      select: { attemptNumber: true },
    });

    const sub = await this.prisma.codeSubmission.create({
      data: {
        codeExerciseId: exerciseId,
        studentId: user.id,
        language: 'SCRATCH',
        code: JSON.stringify({ sb3Url: body.sb3Url, filename: body.filename ?? null }),
        status: 'MANUAL_REVIEW',
        attemptNumber: (last?.attemptNumber ?? 0) + 1,
      },
    });

    return { submissionId: sub.id };
  }

  async mySubmissions(user: AuthUser, exerciseId: string) {
    return this.prisma.codeSubmission.findMany({
      where: { codeExerciseId: exerciseId, studentId: user.id },
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

  async allSubmissions(user: AuthUser, exerciseId: string) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');

    const subs = await this.prisma.codeSubmission.findMany({
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
    const students = await this.prisma.user.findMany({
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

  async grade(
    user: AuthUser,
    submissionId: string,
    body: { score: number; maxScore?: number; feedback?: string }
  ) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');

    const sub = await this.prisma.codeSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        codeExercise: { select: { course: { select: { ownerId: true } } } },
      },
    });
    if (!sub) throw new NotFoundException('Submission không tồn tại.');
    if (user.role === 'TEACHER' && sub.codeExercise.course.ownerId !== user.id)
      throw new ForbiddenException('Bạn không quản lý khoá học này.');

    await this.prisma.codeSubmission.update({
      where: { id: submissionId },
      data: {
        score: body.score,
        maxScore: body.maxScore ?? 10,
        feedback: body.feedback?.trim() || null,
        gradedAt: new Date(),
        gradedBy: user.id,
        status: 'ACCEPTED',
      },
    });

    return { message: 'Đã chấm.' };
  }
}
