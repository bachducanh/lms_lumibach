import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import type { AuthUser } from '../../common/auth/auth.types';
import { canManageCourse } from '../../common/auth/course-access';
import { Judge0Service, LANGUAGE_ID } from '../../common/judge0/judge0.service';

const ROLE_ORDER = ['STUDENT', 'TA', 'TEACHER', 'ADMIN', 'SUPERADMIN'] as const;
type Role = (typeof ROLE_ORDER)[number];
function hasMinRole(r: string, min: Role) {
  return ROLE_ORDER.indexOf(r as Role) >= ROLE_ORDER.indexOf(min);
}

function logActivity(
  prisma: PrismaClient,
  params: {
    userId: string;
    courseId?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    resourceName?: string;
  }
) {
  prisma.activityLog.create({ data: params as any }).catch(() => {});
}

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly judge0: Judge0Service
  ) {}

  private async canManageCourse(userId: string, role: string, courseId: string) {
    return canManageCourse(this.prisma, { id: userId, role }, courseId);
  }

  // ── Start / resume ────────────────────────────────────────────

  async start(user: AuthUser, quizId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId, deletedAt: null, status: 'PUBLISHED' },
      select: {
        id: true,
        courseId: true,
        title: true,
        maxAttempts: true,
        availableFrom: true,
        dueDate: true,
      },
    });
    if (!quiz) throw new NotFoundException('Quiz không tồn tại hoặc chưa được đăng.');

    const now = new Date();
    if (quiz.availableFrom && now < quiz.availableFrom)
      throw new ForbiddenException('Quiz chưa mở.');
    if (quiz.dueDate && now > quiz.dueDate) throw new ForbiddenException('Quiz đã hết hạn.');

    const inProgress = await this.prisma.quizAttempt.findFirst({
      where: { quizId, studentId: user.id, status: 'IN_PROGRESS' },
      select: { id: true },
    });
    if (inProgress) return { attemptId: inProgress.id };

    if (quiz.maxAttempts) {
      const done = await this.prisma.quizAttempt.count({
        where: { quizId, studentId: user.id, status: { in: ['SUBMITTED', 'GRADED'] } },
      });
      if (done >= quiz.maxAttempts) throw new ForbiddenException('Đã hết số lần làm bài.');
    }

    const attempt = await this.prisma.quizAttempt.create({ data: { quizId, studentId: user.id } });
    logActivity(this.prisma, {
      userId: user.id,
      courseId: quiz.courseId,
      action: 'START_QUIZ',
      resourceType: 'quiz',
      resourceId: quizId,
      resourceName: quiz.title,
    });
    return { attemptId: attempt.id };
  }

  // ── Get ───────────────────────────────────────────────────────

  async getById(user: AuthUser, attemptId: string) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          select: {
            title: true,
            timeLimit: true,
            shuffleQuestions: true,
            shuffleAnswers: true,
            showResults: true,
            passingScore: true,
          },
        },
        answers: true,
      },
    });
    if (!attempt) throw new NotFoundException('Không tìm thấy.');
    if (user.role === 'STUDENT' && attempt.studentId !== user.id)
      throw new ForbiddenException('Không có quyền.');

    const quizQuestions = await (this.prisma.quizQuestion as any).findMany({
      where: { quizId: attempt.quizId },
      orderBy: { position: 'asc' },
      include: {
        question: {
          include: {
            options: { orderBy: { position: 'asc' } },
            testCases: { orderBy: { position: 'asc' } },
          },
        },
      },
    });

    const questions = (quizQuestions as any[]).map((qq: any) => ({
      questionId: qq.questionId,
      position: qq.position,
      points: qq.points ?? qq.question.points,
      question: {
        id: qq.question.id,
        type: qq.question.type,
        content: qq.question.content,
        explanation: qq.question.explanation,
        starterCode: qq.question.starterCode ?? null,
        options: qq.question.options.map((o: any) => ({
          id: o.id,
          content: o.content,
          isCorrect: o.isCorrect,
          position: o.position,
        })),
      },
    }));

    const answers = attempt.answers.map((a) => ({
      id: a.id,
      questionId: a.questionId,
      selectedOptionIds: a.selectedOptionIds ? (JSON.parse(a.selectedOptionIds) as string[]) : null,
      booleanAnswer: a.booleanAnswer,
      textAnswer: a.textAnswer,
      isCorrect: a.isCorrect,
      score: a.score,
      feedback: a.feedback,
    }));

    return { ...attempt, questions, answers };
  }

  // ── Save answer ───────────────────────────────────────────────

  async saveAnswer(
    user: AuthUser,
    attemptId: string,
    body: {
      questionId: string;
      type: string;
      selectedOptionIds?: string[];
      booleanAnswer?: boolean;
      textAnswer?: string;
    }
  ) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      select: { studentId: true, status: true },
    });
    if (!attempt || attempt.studentId !== user.id) throw new NotFoundException('Không tìm thấy.');
    if (attempt.status !== 'IN_PROGRESS') throw new ForbiddenException('Bài đã nộp.');

    const base = {
      selectedOptionIds: body.type === 'MCQ' ? JSON.stringify(body.selectedOptionIds ?? []) : null,
      booleanAnswer: body.type === 'TF' ? (body.booleanAnswer ?? null) : null,
      textAnswer: body.type === 'ESSAY' ? (body.textAnswer ?? null) : null,
    };

    await this.prisma.answer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: body.questionId } },
      create: { attemptId, questionId: body.questionId, ...base },
      update: base,
    });

    return { message: '' };
  }

  // ── Submit ────────────────────────────────────────────────────

  async submit(user: AuthUser, attemptId: string) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      select: {
        studentId: true,
        status: true,
        quizId: true,
        quiz: { select: { courseId: true, title: true } },
      },
    });
    if (!attempt || attempt.studentId !== user.id) throw new NotFoundException('Không tìm thấy.');
    if (attempt.status !== 'IN_PROGRESS') throw new ForbiddenException('Bài đã nộp.');

    const quizQuestions = (await (this.prisma.quizQuestion as any).findMany({
      where: { quizId: attempt.quizId },
      include: {
        question: { include: { options: true, testCases: { orderBy: { position: 'asc' } } } },
      },
    })) as any[];

    const savedAnswers = await this.prisma.answer.findMany({ where: { attemptId } });
    const answerMap = new Map(savedAnswers.map((a) => [a.questionId, a]));

    let totalScore = 0;
    let maxScore = 0;
    let needsManualGrading = false;

    type Update = {
      questionId: string;
      selectedOptionIds: string | null;
      booleanAnswer: boolean | null;
      textAnswer: string | null;
      isCorrect: boolean | null;
      score: number | null;
    };
    const updates: Update[] = [];

    for (const qq of quizQuestions) {
      const pts = (qq.points ?? qq.question.points) as number;
      maxScore += pts;
      const ans = answerMap.get(qq.questionId);
      const type = qq.question.type as string;
      const opts = qq.question.options as { id: string; content: string; isCorrect: boolean }[];

      if (type === 'ESSAY' || type === 'CODE_WEB') {
        needsManualGrading = true;
        updates.push({
          questionId: qq.questionId,
          selectedOptionIds: null,
          booleanAnswer: null,
          textAnswer: ans?.textAnswer ?? null,
          isCorrect: null,
          score: null,
        });
        continue;
      }

      if (type === 'MULTIPLE_CHOICE_SINGLE' || type === 'MULTIPLE_CHOICE_MULTIPLE') {
        const correctIds = opts
          .filter((o) => o.isCorrect)
          .map((o) => o.id)
          .sort();
        const selectedIds = ans?.selectedOptionIds
          ? (JSON.parse(ans.selectedOptionIds) as string[]).sort()
          : [];
        const isCorrect =
          correctIds.length > 0 &&
          correctIds.length === selectedIds.length &&
          correctIds.every((id, i) => id === selectedIds[i]);
        const score = isCorrect ? pts : 0;
        totalScore += score;
        updates.push({
          questionId: qq.questionId,
          selectedOptionIds: ans?.selectedOptionIds ?? null,
          booleanAnswer: null,
          textAnswer: null,
          isCorrect,
          score,
        });
        continue;
      }

      if (type === 'TRUE_FALSE') {
        const correctIsDong = opts.find((o) => o.content === 'Đúng')?.isCorrect ?? false;
        const isCorrect = (ans?.booleanAnswer ?? null) === correctIsDong;
        const score = isCorrect ? pts : 0;
        totalScore += score;
        updates.push({
          questionId: qq.questionId,
          selectedOptionIds: null,
          booleanAnswer: ans?.booleanAnswer ?? null,
          textAnswer: null,
          isCorrect,
          score,
        });
        continue;
      }

      if (type === 'TRUE_FALSE_MULTI') {
        const studentDong = new Set<string>(
          ans?.selectedOptionIds ? (JSON.parse(ans.selectedOptionIds) as string[]) : []
        );
        let correct = 0;
        for (const opt of opts) {
          if (studentDong.has(opt.id) === opt.isCorrect) correct++;
        }
        const score = opts.length > 0 ? Math.round((correct / opts.length) * pts * 10) / 10 : 0;
        totalScore += score;
        updates.push({
          questionId: qq.questionId,
          selectedOptionIds: ans?.selectedOptionIds ?? null,
          booleanAnswer: null,
          textAnswer: null,
          isCorrect: correct === opts.length,
          score,
        });
        continue;
      }

      if (type === 'PARSONS' || type === 'ORDERING') {
        const studentIds: string[] = (() => {
          try {
            return JSON.parse(ans?.textAnswer ?? '[]') as string[];
          } catch {
            return [];
          }
        })();
        const sortedOpts = [...opts].sort((a: any, b: any) => a.position - b.position);
        let correct = 0;
        for (let idx = 0; idx < sortedOpts.length; idx++) {
          if (studentIds[idx] === sortedOpts[idx]!.id) correct++;
        }
        const score =
          sortedOpts.length > 0 ? Math.round((correct / sortedOpts.length) * pts * 10) / 10 : 0;
        totalScore += score;
        updates.push({
          questionId: qq.questionId,
          selectedOptionIds: null,
          booleanAnswer: null,
          textAnswer: ans?.textAnswer ?? null,
          isCorrect: correct === sortedOpts.length,
          score,
        });
        continue;
      }

      if (type === 'MATCHING') {
        // textAnswer = JSON map { leftOptionId: rightOptionId }. Each option holds one
        // pair, so a match is correct when the chosen right belongs to the same option.
        const map: Record<string, string> = (() => {
          try {
            return JSON.parse(ans?.textAnswer ?? '{}') as Record<string, string>;
          } catch {
            return {};
          }
        })();
        let correct = 0;
        for (const opt of opts) {
          if (map[opt.id] === opt.id) correct++;
        }
        const score = opts.length > 0 ? Math.round((correct / opts.length) * pts * 10) / 10 : 0;
        totalScore += score;
        updates.push({
          questionId: qq.questionId,
          selectedOptionIds: null,
          booleanAnswer: null,
          textAnswer: ans?.textAnswer ?? null,
          isCorrect: correct === opts.length,
          score,
        });
        continue;
      }

      if (type === 'CODE_FILL') {
        const studentFills: string[] = (() => {
          try {
            return JSON.parse(ans?.textAnswer ?? '[]') as string[];
          } catch {
            return [];
          }
        })();
        const sortedBlanks = [...opts].sort((a: any, b: any) => a.position - b.position);
        let correct = 0;
        for (let idx = 0; idx < sortedBlanks.length; idx++) {
          if ((studentFills[idx] ?? '').trim() === sortedBlanks[idx]!.content.trim()) correct++;
        }
        const score =
          sortedBlanks.length > 0 ? Math.round((correct / sortedBlanks.length) * pts * 10) / 10 : 0;
        totalScore += score;
        updates.push({
          questionId: qq.questionId,
          selectedOptionIds: null,
          booleanAnswer: null,
          textAnswer: ans?.textAnswer ?? null,
          isCorrect: correct === sortedBlanks.length,
          score,
        });
        continue;
      }

      if (['CODE_PYTHON', 'CODE_CPP', 'CODE_DEBUG_PYTHON', 'CODE_DEBUG_CPP'].includes(type)) {
        const code = ans?.textAnswer ?? '';
        const testCases = (qq.question.testCases ?? []) as any[];
        const langId =
          type === 'CODE_PYTHON' || type === 'CODE_DEBUG_PYTHON'
            ? LANGUAGE_ID.PYTHON3
            : LANGUAGE_ID.CPP17;
        const timeLim = (qq.question.timeLimit as number | null) ?? 3;
        const memLim = (qq.question.memoryLimit as number | null) ?? 262144;

        if (!code.trim() || testCases.length === 0) {
          updates.push({
            questionId: qq.questionId,
            selectedOptionIds: null,
            booleanAnswer: null,
            textAnswer: code || null,
            isCorrect: false,
            score: 0,
          });
          continue;
        }

        let codeScore = 0;
        const maxTcPts = testCases.reduce((s: number, tc: any) => s + (tc.points as number), 0);

        await Promise.all(
          testCases.map(async (tc: any) => {
            try {
              const result = await this.judge0.runCode({
                languageId: langId,
                sourceCode: code,
                stdin: tc.input,
                expectedOutput: tc.expectedOutput,
                cpuTimeLimit: timeLim,
                memoryLimit: memLim,
              });
              if (
                result.status.id === 3 &&
                (result.stdout?.trim() ?? '') === String(tc.expectedOutput).trim()
              ) {
                codeScore += tc.points as number;
              }
            } catch {
              /* Judge0 unavailable — skip */
            }
          })
        );

        const score = maxTcPts > 0 ? Math.round((codeScore / maxTcPts) * pts * 10) / 10 : 0;
        totalScore += score;
        updates.push({
          questionId: qq.questionId,
          selectedOptionIds: null,
          booleanAnswer: null,
          textAnswer: code,
          isCorrect: score === pts,
          score,
        });
        continue;
      }
    }

    const ops: any[] = updates.map((u) =>
      this.prisma.answer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: u.questionId } },
        create: {
          attemptId,
          questionId: u.questionId,
          selectedOptionIds: u.selectedOptionIds,
          booleanAnswer: u.booleanAnswer,
          textAnswer: u.textAnswer,
          isCorrect: u.isCorrect,
          score: u.score,
        },
        update: {
          isCorrect: u.isCorrect,
          score: u.score,
          ...(u.textAnswer !== null ? { textAnswer: u.textAnswer } : {}),
        },
      })
    );

    ops.push(
      this.prisma.quizAttempt.update({
        where: { id: attemptId },
        data: {
          status: needsManualGrading ? 'SUBMITTED' : 'GRADED',
          submittedAt: new Date(),
          score: totalScore,
          maxScore,
        },
      })
    );

    await this.prisma.$transaction(ops);
    logActivity(this.prisma, {
      userId: user.id,
      courseId: attempt.quiz.courseId,
      action: 'SUBMIT_QUIZ',
      resourceType: 'quiz',
      resourceId: attempt.quizId,
      resourceName: attempt.quiz.title,
    });
    return { message: 'Đã nộp bài.' };
  }

  // ── List ──────────────────────────────────────────────────────

  async listMine(user: AuthUser, quizId: string) {
    return this.prisma.quizAttempt.findMany({
      where: { quizId, studentId: user.id },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        status: true,
        startedAt: true,
        submittedAt: true,
        score: true,
        maxScore: true,
      },
    });
  }

  async listAll(user: AuthUser, quizId: string) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');
    return this.prisma.quizAttempt.findMany({
      where: { quizId },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        status: true,
        startedAt: true,
        submittedAt: true,
        score: true,
        maxScore: true,
        student: { select: { id: true, fullName: true, firstName: true, lastName: true } },
      },
    });
  }

  async listDetailed(user: AuthUser, quizId: string) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');

    const [rawAttempts, rawQuestions] = await Promise.all([
      this.prisma.quizAttempt.findMany({
        where: { quizId },
        orderBy: { startedAt: 'asc' },
        select: {
          id: true,
          status: true,
          startedAt: true,
          submittedAt: true,
          score: true,
          maxScore: true,
          student: {
            select: { id: true, fullName: true, firstName: true, lastName: true, email: true },
          },
          answers: { select: { questionId: true, score: true, isCorrect: true } },
        },
      }),
      this.prisma.quizQuestion.findMany({
        where: { quizId },
        orderBy: { position: 'asc' },
        select: { questionId: true, position: true, points: true },
      }),
    ]);

    const questions = rawQuestions.map((q) => ({
      questionId: q.questionId,
      position: q.position,
      points: q.points ?? 1,
    }));
    return { attempts: rawAttempts, questions };
  }

  async deleteMany(user: AuthUser, ids: string[]) {
    if (!ids.length) throw new ForbiddenException('Không có bài nào được chọn.');
    if (!hasMinRole(user.role, 'TEACHER')) throw new ForbiddenException('Không có quyền.');
    await this.prisma.quizAttempt.deleteMany({ where: { id: { in: ids } } });
    return { message: `Đã xoá ${ids.length} bài làm.` };
  }

  // ── Grade essay ───────────────────────────────────────────────

  async gradeEssay(
    user: AuthUser,
    answerId: string,
    body: { score: number; feedback?: string | null }
  ) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');

    const answerRow = await this.prisma.answer.findUnique({
      where: { id: answerId },
      select: {
        attemptId: true,
        attempt: {
          select: {
            studentId: true,
            quizId: true,
            quiz: { select: { title: true, courseId: true, course: { select: { slug: true } } } },
          },
        },
      },
    });
    if (!answerRow) throw new NotFoundException('Không tìm thấy câu trả lời.');

    if (user.role !== 'ADMIN') {
      const ok = await this.canManageCourse(user.id, user.role, answerRow.attempt.quiz.courseId);
      if (!ok) throw new ForbiddenException('Không có quyền.');
    }

    await this.prisma.answer.update({
      where: { id: answerId },
      data: { score: body.score, feedback: body.feedback ?? null },
    });

    const allAnswers = await this.prisma.answer.findMany({
      where: { attemptId: answerRow.attemptId },
      select: { score: true },
    });
    const totalScore = allAnswers.reduce((sum, a) => sum + (a.score ?? 0), 0);
    const allGraded = allAnswers.every((a) => a.score !== null);
    const questionCount = await this.prisma.quizQuestion.count({
      where: { quizId: answerRow.attempt.quizId },
    });
    const fullyGraded = allGraded && allAnswers.length >= questionCount;

    await this.prisma.quizAttempt.update({
      where: { id: answerRow.attemptId },
      data: { score: totalScore, ...(fullyGraded ? { status: 'GRADED' } : {}) },
    });

    if (fullyGraded) {
      this.prisma.notification
        .create({
          data: {
            userId: answerRow.attempt.studentId,
            type: 'QUIZ_GRADED',
            title: `Quiz "${answerRow.attempt.quiz.title}" đã được chấm`,
            body: `Điểm của bạn: ${totalScore.toFixed(1)} điểm.`,
            link: `/courses/${answerRow.attempt.quiz.course.slug}/quizzes/${answerRow.attempt.quizId}`,
          },
        })
        .catch(() => {});
    }

    return { message: 'Đã chấm điểm.' };
  }
}
