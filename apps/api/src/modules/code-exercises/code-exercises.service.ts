import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import type { AuthUser } from '../../common/auth/auth.types';
import { Judge0Service } from '../../common/judge0/judge0.service';

const ROLE_ORDER = ['STUDENT', 'TA', 'TEACHER', 'ADMIN', 'SUPERADMIN'] as const;
type Role = (typeof ROLE_ORDER)[number];
function hasMinRole(r: string, min: Role) {
  return ROLE_ORDER.indexOf(r as Role) >= ROLE_ORDER.indexOf(min);
}

const LANG_MAP: Record<string, number> = { PYTHON3: 71, JAVASCRIPT: 63, CPP17: 54 };

@Injectable()
export class CodeExercisesService {
  private readonly prisma = new PrismaClient();

  constructor(private readonly judge0: Judge0Service) {}

  // ── CRUD ──────────────────────────────────────────────────────

  async create(
    user: AuthUser,
    body: { courseId: string; title: string; language: string; moduleId?: string }
  ) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');

    const exercise = await this.prisma.codeExercise.create({
      data: {
        courseId: body.courseId,
        title: body.title,
        language: body.language as any,
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
          title: body.title,
          codeExerciseId: exercise.id,
          position: (last?.position ?? -1) + 1,
          isPublished: true,
        },
      });
    }

    return { exerciseId: exercise.id };
  }

  async findOne(exerciseId: string) {
    const ex = await this.prisma.codeExercise.findUnique({
      where: { id: exerciseId, deletedAt: null },
      include: { testCases: { orderBy: { position: 'asc' } } },
    });
    if (!ex) throw new NotFoundException('Bài tập không tồn tại.');
    return ex;
  }

  async update(user: AuthUser, exerciseId: string, body: Record<string, unknown>) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');
    await this.prisma.codeExercise.update({ where: { id: exerciseId }, data: body as any });
    return { message: 'Đã lưu cấu hình' };
  }

  async saveTestCases(
    user: AuthUser,
    exerciseId: string,
    testCases: {
      label?: string | null;
      input: string;
      expectedOutput: string;
      isHidden: boolean;
      points: number;
    }[]
  ) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');
    await this.prisma.$transaction(async (tx) => {
      await tx.testCase.deleteMany({ where: { codeExerciseId: exerciseId } });
      if (testCases.length > 0) {
        await tx.testCase.createMany({
          data: testCases.map((tc, i) => ({
            codeExerciseId: exerciseId,
            label: tc.label ?? null,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: tc.isHidden,
            points: tc.points,
            position: i,
          })),
        });
      }
    });
    return { message: `Đã lưu ${testCases.length} test case` };
  }

  // ── Run / Submit ───────────────────────────────────────────────

  async run(exerciseId: string, body: { code: string; language: string; stdin?: string }) {
    const ex = await this.prisma.codeExercise.findUnique({ where: { id: exerciseId } });
    if (!ex) throw new NotFoundException('Bài tập không tồn tại.');

    const langId = LANG_MAP[body.language];
    if (!langId) throw new BadRequestException('Ngôn ngữ không hỗ trợ.');

    const result = await this.judge0.runCode({
      languageId: langId,
      sourceCode: body.code,
      stdin: body.stdin?.trim() || undefined,
      cpuTimeLimit: ex.timeLimit,
      memoryLimit: ex.memoryLimit,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      compileOutput: result.compile_output,
      statusDesc: result.status.description,
      time: result.time,
      memory: result.memory,
    };
  }

  async submit(user: AuthUser, exerciseId: string, body: { code: string; language: string }) {
    if (!body.code.trim()) throw new BadRequestException('Code trống');

    const ex = await this.prisma.codeExercise.findUnique({ where: { id: exerciseId } });
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
        language: body.language as any,
        code: body.code,
        status: 'MANUAL_REVIEW',
        attemptNumber: (last?.attemptNumber ?? 0) + 1,
      },
    });

    return { submissionId: sub.id };
  }

  // ── Submissions ────────────────────────────────────────────────

  async mySubmissions(user: AuthUser, exerciseId: string) {
    return this.prisma.codeSubmission.findMany({
      where: { codeExerciseId: exerciseId, studentId: user.id },
      orderBy: { attemptNumber: 'desc' },
      select: {
        id: true,
        status: true,
        score: true,
        maxScore: true,
        submittedAt: true,
        attemptNumber: true,
        language: true,
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
        submittedAt: true,
        attemptNumber: true,
        language: true,
      },
    });

    if (subs.length === 0) return [];

    const studentIds = [...new Set(subs.map((s) => s.studentId))];
    const students = await this.prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true, fullName: true, email: true },
    });
    const byId = new Map(students.map((u) => [u.id, u]));

    return subs.map((s) => ({
      ...s,
      student: byId.get(s.studentId) ?? {
        id: s.studentId,
        firstName: '?',
        lastName: '?',
        fullName: null,
        email: s.studentId,
      },
    }));
  }

  async getSubmission(user: AuthUser, submissionId: string) {
    const sub = await this.prisma.codeSubmission.findUnique({
      where: { id: submissionId },
      include: {
        results: {
          include: {
            testCase: { select: { label: true, position: true, isHidden: true, points: true } },
          },
          orderBy: { testCase: { position: 'asc' } },
        },
      },
    });
    if (!sub) throw new NotFoundException('Bài nộp không tồn tại.');
    if (!hasMinRole(user.role, 'TA') && sub.studentId !== user.id)
      throw new ForbiddenException('Không có quyền.');
    return sub;
  }

  async grade(
    user: AuthUser,
    submissionId: string,
    body: { score: number; maxScore: number; feedback?: string }
  ) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');
    await this.prisma.codeSubmission.update({
      where: { id: submissionId },
      data: {
        score: body.score,
        maxScore: body.maxScore,
        status: 'ACCEPTED',
        feedback: body.feedback || null,
        gradedAt: new Date(),
        gradedBy: user.id,
      },
    });
    return { message: 'Đã chấm điểm' };
  }

  async deleteSubmission(user: AuthUser, submissionId: string) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');
    const sub = await this.prisma.codeSubmission.findUnique({ where: { id: submissionId } });
    if (!sub) throw new NotFoundException('Bài nộp không tồn tại.');
    await this.prisma.codeSubmission.delete({ where: { id: submissionId } });
    return { message: 'Đã xoá bài nộp' };
  }

  // ── List by module ─────────────────────────────────────────────

  async listByModule(user: AuthUser, courseId: string) {
    if (!courseId) throw new BadRequestException('courseId required');
    const isStaff = hasMinRole(user.role, 'TA');
    const statusFilter = isStaff ? {} : { status: 'PUBLISHED' as const };

    const [modules, exercises] = await Promise.all([
      this.prisma.module.findMany({
        where: { courseId, ...(isStaff ? {} : { isPublished: true }) },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          name: true,
          position: true,
          items: {
            where: { type: 'CODE_EXERCISE', ...(isStaff ? {} : { isPublished: true }) },
            orderBy: { position: 'asc' },
            select: { codeExerciseId: true },
          },
        },
      }),
      this.prisma.codeExercise.findMany({
        where: { courseId, deletedAt: null, ...statusFilter },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          language: true,
          status: true,
          _count: { select: { submissions: true } },
        },
      }),
    ]);

    const exMap = new Map(exercises.map((e) => [e.id, e]));
    const linkedIds = new Set<string>();
    const groups: {
      moduleId: string;
      moduleName: string;
      position: number;
      exercises: typeof exercises;
    }[] = [];

    for (const mod of modules) {
      const modExercises = [];
      for (const item of mod.items) {
        if (item.codeExerciseId && exMap.has(item.codeExerciseId)) {
          modExercises.push(exMap.get(item.codeExerciseId)!);
          linkedIds.add(item.codeExerciseId);
        }
      }
      if (modExercises.length > 0) {
        groups.push({
          moduleId: mod.id,
          moduleName: mod.name,
          position: mod.position,
          exercises: modExercises,
        });
      }
    }

    const standalone = isStaff ? exercises.filter((e) => !linkedIds.has(e.id)) : [];
    return { groups, standalone };
  }
}
