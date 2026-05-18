import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaClient } from '@lumibach/db';
import type { AuthUser } from '../../common/auth/auth.types';
import { Judge0Service } from '../../common/judge0/judge0.service';
import { CodeExecutionGateway } from './code-execution.gateway';
import { NotificationsService } from '../notifications/notifications.service';

const ROLE_ORDER = ['STUDENT', 'TA', 'TEACHER', 'ADMIN', 'SUPERADMIN'] as const;
type Role = (typeof ROLE_ORDER)[number];
function hasMinRole(r: string, min: Role) {
  return ROLE_ORDER.indexOf(r as Role) >= ROLE_ORDER.indexOf(min);
}

const LANG_MAP: Record<string, number> = { PYTHON3: 71, JAVASCRIPT: 63, CPP17: 54 };

@Injectable()
export class CodeExercisesService {
  private readonly logger = new Logger(CodeExercisesService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly judge0: Judge0Service,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Optional() private readonly gateway: CodeExecutionGateway | null = null,
    @Optional() private readonly notifications: NotificationsService | null = null
  ) {}

  private async invalidateModuleCache(courseId: string): Promise<void> {
    await Promise.allSettled([
      this.cache.del(`modules:${courseId}`),
      this.cache.del(`modules:pub:${courseId}`),
      this.cache.del(`modules:nav:${courseId}`),
      this.cache.del(`modules:nav:pub:${courseId}`),
    ]);
  }

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
      await this.invalidateModuleCache(body.courseId);
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

    const ex = await this.prisma.codeExercise.findUnique({
      where: { id: exerciseId },
      include: { testCases: { orderBy: { position: 'asc' } } },
    });
    if (!ex) throw new NotFoundException('Bài tập không tồn tại.');

    const last = await this.prisma.codeSubmission.findFirst({
      where: { codeExerciseId: exerciseId, studentId: user.id },
      orderBy: { attemptNumber: 'desc' },
      select: { attemptNumber: true },
    });

    const autoGraded = ex.language !== 'WEB' && ex.testCases.length > 0;

    const sub = await this.prisma.codeSubmission.create({
      data: {
        codeExerciseId: exerciseId,
        studentId: user.id,
        language: body.language as any,
        code: body.code,
        status: autoGraded ? 'PENDING' : 'MANUAL_REVIEW',
        attemptNumber: (last?.attemptNumber ?? 0) + 1,
      },
    });

    if (autoGraded) {
      const langId = LANG_MAP[body.language];
      if (langId) {
        this.autoGrade(sub.id, ex as any, body.code, langId).catch((err: unknown) => {
          this.logger.error(`autoGrade failed for ${sub.id}: ${String(err)}`);
          this.prisma.codeSubmission
            .update({ where: { id: sub.id }, data: { status: 'INTERNAL_ERROR' } })
            .catch(() => {});
          this.gateway?.emitResult(sub.id, {
            status: 'INTERNAL_ERROR',
            score: null,
            maxScore: null,
          });
        });
      }
    }

    return { submissionId: sub.id, autoGraded };
  }

  private async autoGrade(
    submissionId: string,
    ex: {
      id: string;
      timeLimit: number;
      memoryLimit: number;
      testCases: {
        id: string;
        input: string;
        expectedOutput: string;
        isHidden: boolean;
        points: number;
      }[];
    },
    code: string,
    langId: number
  ): Promise<void> {
    await this.prisma.codeSubmission.update({
      where: { id: submissionId },
      data: { status: 'PROCESSING' },
    });

    let totalPoints = 0;
    let earnedPoints = 0;
    let dominantStatus: 'COMPILE_ERROR' | 'RUNTIME_ERROR' | 'TIME_LIMIT' | 'INTERNAL_ERROR' | null =
      null;

    for (const tc of ex.testCases) {
      const result = await this.judge0.runCode({
        languageId: langId,
        sourceCode: code,
        stdin: tc.input || undefined,
        expectedOutput: tc.expectedOutput || undefined,
        cpuTimeLimit: ex.timeLimit,
        memoryLimit: ex.memoryLimit,
      });

      const sid = result.status.id;
      let tcStatus:
        | 'ACCEPTED'
        | 'WRONG_ANSWER'
        | 'COMPILE_ERROR'
        | 'RUNTIME_ERROR'
        | 'TIME_LIMIT'
        | 'INTERNAL_ERROR';
      if (sid === 3) tcStatus = 'ACCEPTED';
      else if (sid === 4) tcStatus = 'WRONG_ANSWER';
      else if (sid === 5) tcStatus = 'TIME_LIMIT';
      else if (sid === 6) tcStatus = 'COMPILE_ERROR';
      else if (sid >= 7 && sid <= 12) tcStatus = 'RUNTIME_ERROR';
      else tcStatus = 'INTERNAL_ERROR';

      const tcPoints = tcStatus === 'ACCEPTED' ? tc.points : 0;
      totalPoints += tc.points;
      earnedPoints += tcPoints;

      if (!dominantStatus && tcStatus !== 'ACCEPTED' && tcStatus !== 'WRONG_ANSWER') {
        dominantStatus = tcStatus;
      }

      await this.prisma.testCaseResult.create({
        data: {
          submissionId,
          testCaseId: tc.id,
          status: tcStatus,
          stdout: result.stdout,
          stderr: result.stderr,
          compileOutput: result.compile_output,
          time: result.time ? parseFloat(result.time) : null,
          memory: result.memory,
          score: tcPoints,
          judge0Token: result.token,
        },
      });

      // Stop on compile error — remaining test cases will also fail
      if (tcStatus === 'COMPILE_ERROR') break;
    }

    let finalStatus:
      | 'ACCEPTED'
      | 'PARTIAL'
      | 'WRONG_ANSWER'
      | 'COMPILE_ERROR'
      | 'RUNTIME_ERROR'
      | 'TIME_LIMIT'
      | 'INTERNAL_ERROR';
    if (dominantStatus) finalStatus = dominantStatus;
    else if (earnedPoints === totalPoints) finalStatus = 'ACCEPTED';
    else if (earnedPoints > 0) finalStatus = 'PARTIAL';
    else finalStatus = 'WRONG_ANSWER';

    await this.prisma.codeSubmission.update({
      where: { id: submissionId },
      data: { status: finalStatus, score: earnedPoints, maxScore: totalPoints },
    });

    this.gateway?.emitResult(submissionId, {
      status: finalStatus,
      score: earnedPoints,
      maxScore: totalPoints,
    });

    // Notify student
    const sub = await this.prisma.codeSubmission.findUnique({
      where: { id: submissionId },
      select: { studentId: true, codeExercise: { select: { title: true } } },
    });
    if (sub) {
      await this.notifications?.create(sub.studentId, {
        type: 'CODE_GRADED',
        title: `Bài "${sub.codeExercise.title}" đã được chấm`,
        body:
          finalStatus === 'ACCEPTED'
            ? `Xuất sắc! Đạt ${earnedPoints}/${totalPoints} điểm.`
            : `Kết quả: ${finalStatus}. Đạt ${earnedPoints}/${totalPoints} điểm.`,
        link: null,
      });
    }
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
