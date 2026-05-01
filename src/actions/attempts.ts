'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import type { ActionResult } from '@/actions/auth';
import type { UserRole } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────

export type AttemptQuestion = {
  questionId: string;
  position:   number;
  points:     number;
  question: {
    id:          string;
    type:        string;
    content:     string;
    explanation: string | null;
    options:     { id: string; content: string; isCorrect: boolean; position: number }[];
  };
};

export type AttemptAnswer = {
  id:                string;
  questionId:        string;
  selectedOptionIds: string[] | null;
  booleanAnswer:     boolean | null;
  textAnswer:        string | null;
  isCorrect:         boolean | null;
  score:             number | null;
  feedback:          string | null;
};

export type AttemptData = {
  id:          string;
  quizId:      string;
  studentId:   string;
  status:      string;
  startedAt:   Date;
  submittedAt: Date | null;
  score:       number | null;
  maxScore:    number | null;
  quiz: {
    title:            string;
    timeLimit:        number | null;
    shuffleQuestions: boolean;
    shuffleAnswers:   boolean;
    showResults:      boolean;
    passingScore:     number | null;
  };
  questions: AttemptQuestion[];
  answers:   AttemptAnswer[];
};

export type AttemptListItem = {
  id:          string;
  status:      string;
  startedAt:   Date;
  submittedAt: Date | null;
  score:       number | null;
  maxScore:    number | null;
  student?:    { id: string; fullName: string | null; firstName: string; lastName: string };
};

// ── Helpers ───────────────────────────────────────────────────

async function canManageCourse(userId: string, role: UserRole, courseId: string) {
  if (role === 'ADMIN') return true;
  if (role !== 'TEACHER') return false;
  const c = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
  return c?.ownerId === userId;
}

// ── Start or resume attempt ────────────────────────────────────

export async function startAttemptAction(quizId: string): Promise<ActionResult<{ attemptId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const userId = session.user.id;

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId, deletedAt: null, status: 'PUBLISHED' },
    select: { id: true, maxAttempts: true, availableFrom: true, dueDate: true },
  });
  if (!quiz) return { success: false, error: 'Quiz không tồn tại hoặc chưa được đăng.' };

  const now = new Date();
  if (quiz.availableFrom && now < quiz.availableFrom) return { success: false, error: 'Quiz chưa mở.' };
  if (quiz.dueDate && now > quiz.dueDate) return { success: false, error: 'Quiz đã hết hạn.' };

  // Resume existing in-progress attempt
  const inProgress = await prisma.quizAttempt.findFirst({
    where: { quizId, studentId: userId, status: 'IN_PROGRESS' },
    select: { id: true },
  });
  if (inProgress) return { success: true, message: '', data: { attemptId: inProgress.id } };

  // Check maxAttempts
  if (quiz.maxAttempts) {
    const done = await prisma.quizAttempt.count({
      where: { quizId, studentId: userId, status: { in: ['SUBMITTED', 'GRADED'] } },
    });
    if (done >= quiz.maxAttempts) return { success: false, error: 'Đã hết số lần làm bài.' };
  }

  const attempt = await prisma.quizAttempt.create({
    data: { quizId, studentId: userId },
  });
  return { success: true, message: 'Bắt đầu làm bài.', data: { attemptId: attempt.id } };
}

// ── Get attempt ────────────────────────────────────────────────

export async function getAttemptAction(attemptId: string): Promise<AttemptData | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const role = session.user.role as UserRole;

  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        select: {
          title: true, timeLimit: true, shuffleQuestions: true,
          shuffleAnswers: true, showResults: true, passingScore: true,
        },
      },
      answers: true,
    },
  });
  if (!attempt) return null;

  // Students can only see their own attempts
  if (role === 'STUDENT' && attempt.studentId !== session.user.id) return null;

  const quizQuestions = await prisma.quizQuestion.findMany({
    where: { quizId: attempt.quizId },
    orderBy: { position: 'asc' },
    include: {
      question: { include: { options: { orderBy: { position: 'asc' } } } },
    },
  });

  const questions: AttemptQuestion[] = quizQuestions.map((qq) => ({
    questionId: qq.questionId,
    position:   qq.position,
    points:     qq.points ?? qq.question.points,
    question: {
      id:          qq.question.id,
      type:        qq.question.type,
      content:     qq.question.content,
      explanation: qq.question.explanation,
      options:     qq.question.options.map((o) => ({
        id: o.id, content: o.content, isCorrect: o.isCorrect, position: o.position,
      })),
    },
  }));

  const answers: AttemptAnswer[] = attempt.answers.map((a) => ({
    id:                a.id,
    questionId:        a.questionId,
    selectedOptionIds: a.selectedOptionIds ? JSON.parse(a.selectedOptionIds) as string[] : null,
    booleanAnswer:     a.booleanAnswer,
    textAnswer:        a.textAnswer,
    isCorrect:         a.isCorrect,
    score:             a.score,
    feedback:          a.feedback,
  }));

  return {
    id:          attempt.id,
    quizId:      attempt.quizId,
    studentId:   attempt.studentId,
    status:      attempt.status,
    startedAt:   attempt.startedAt,
    submittedAt: attempt.submittedAt,
    score:       attempt.score,
    maxScore:    attempt.maxScore,
    quiz:        attempt.quiz,
    questions,
    answers,
  };
}

// ── Save single answer ─────────────────────────────────────────

export type AnswerInput =
  | { type: 'MCQ';   selectedOptionIds: string[] }
  | { type: 'TF';    booleanAnswer: boolean }
  | { type: 'ESSAY'; textAnswer: string };

export async function saveAnswerAction(
  attemptId:  string,
  questionId: string,
  answer:     AnswerInput,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };

  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    select: { studentId: true, status: true },
  });
  if (!attempt || attempt.studentId !== session.user.id)
    return { success: false, error: 'Không tìm thấy.' };
  if (attempt.status !== 'IN_PROGRESS') return { success: false, error: 'Bài đã nộp.' };

  const base = {
    selectedOptionIds: answer.type === 'MCQ' ? JSON.stringify(answer.selectedOptionIds) : null,
    booleanAnswer:     answer.type === 'TF'    ? answer.booleanAnswer : null,
    textAnswer:        answer.type === 'ESSAY' ? answer.textAnswer    : null,
  };

  await prisma.answer.upsert({
    where:  { attemptId_questionId: { attemptId, questionId } },
    create: { attemptId, questionId, ...base },
    update: base,
  });
  return { success: true, message: '' };
}

// ── Submit attempt (auto-grade MCQ / TRUE_FALSE) ───────────────

export async function submitAttemptAction(attemptId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };

  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    select: { studentId: true, status: true, quizId: true },
  });
  if (!attempt || attempt.studentId !== session.user.id)
    return { success: false, error: 'Không tìm thấy.' };
  if (attempt.status !== 'IN_PROGRESS') return { success: false, error: 'Bài đã nộp.' };

  const quizQuestions = await prisma.quizQuestion.findMany({
    where: { quizId: attempt.quizId },
    include: { question: { include: { options: true } } },
  });

  const savedAnswers = await prisma.answer.findMany({ where: { attemptId } });
  const answerMap = new Map(savedAnswers.map((a) => [a.questionId, a]));

  let totalScore = 0;
  let maxScore   = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: ReturnType<typeof prisma.answer.upsert | typeof prisma.quizAttempt.update>[] = [] as any[];

  for (const qq of quizQuestions) {
    const pts  = qq.points ?? qq.question.points;
    maxScore  += pts;
    const ans  = answerMap.get(qq.questionId);
    const type = qq.question.type;
    const opts = qq.question.options;

    if (type === 'ESSAY') {
      ops.push(
        prisma.answer.upsert({
          where:  { attemptId_questionId: { attemptId, questionId: qq.questionId } },
          create: { attemptId, questionId: qq.questionId, textAnswer: ans?.textAnswer ?? null },
          update: {},
        }),
      );
      continue; // essay not auto-graded; score stays null
    }

    let isCorrect = false;
    if (type === 'MULTIPLE_CHOICE_SINGLE' || type === 'MULTIPLE_CHOICE_MULTIPLE') {
      const correctIds  = opts.filter((o) => o.isCorrect).map((o) => o.id).sort();
      const selectedIds = ans?.selectedOptionIds
        ? (JSON.parse(ans.selectedOptionIds) as string[]).sort()
        : [];
      isCorrect = correctIds.length > 0
        && correctIds.length === selectedIds.length
        && correctIds.every((id, i) => id === selectedIds[i]);
    } else if (type === 'TRUE_FALSE') {
      const correctIsDong = opts.find((o) => o.content === 'Đúng')?.isCorrect ?? false;
      isCorrect = (ans?.booleanAnswer ?? null) === correctIsDong;
    }

    const score = isCorrect ? pts : 0;
    totalScore += score;

    ops.push(
      prisma.answer.upsert({
        where:  { attemptId_questionId: { attemptId, questionId: qq.questionId } },
        create: {
          attemptId, questionId: qq.questionId,
          selectedOptionIds: ans?.selectedOptionIds ?? null,
          booleanAnswer:     ans?.booleanAnswer     ?? null,
          isCorrect, score,
        },
        update: { isCorrect, score },
      }),
    );
  }

  const hasEssay = quizQuestions.some((qq) => qq.question.type === 'ESSAY');
  ops.push(
    prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        status:      hasEssay ? 'SUBMITTED' : 'GRADED',
        submittedAt: new Date(),
        score:       totalScore,
        maxScore,
      },
    }),
  );

  await prisma.$transaction(ops);
  return { success: true, message: 'Đã nộp bài.' };
}

// ── List my attempts ───────────────────────────────────────────

export async function listMyAttemptsAction(quizId: string): Promise<AttemptListItem[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  return prisma.quizAttempt.findMany({
    where:   { quizId, studentId: session.user.id },
    orderBy: { startedAt: 'desc' },
    select:  { id: true, status: true, startedAt: true, submittedAt: true, score: true, maxScore: true },
  }) as Promise<AttemptListItem[]>;
}

// ── List all attempts (teacher / admin) ────────────────────────

export async function listAllAttemptsAction(quizId: string): Promise<AttemptListItem[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const role = session.user.role as UserRole;
  if (!hasMinRole(role, 'TA')) return [];

  return prisma.quizAttempt.findMany({
    where:   { quizId },
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true, status: true, startedAt: true, submittedAt: true, score: true, maxScore: true,
      student: { select: { id: true, fullName: true, firstName: true, lastName: true } },
    },
  }) as Promise<AttemptListItem[]>;
}

// ── Detailed attempts table (with per-question scores + email) ──

export type AttemptDetailRow = {
  id:          string;
  status:      string;
  startedAt:   Date;
  submittedAt: Date | null;
  score:       number | null;
  maxScore:    number | null;
  student: {
    id:        string;
    fullName:  string | null;
    firstName: string;
    lastName:  string;
    email:     string;
  } | null;
  answers: { questionId: string; score: number | null; isCorrect: boolean | null }[];
};

export type QuizQuestionBrief = {
  questionId: string;
  position:   number;
  points:     number;
};

export async function listAllAttemptsDetailedAction(
  quizId: string,
): Promise<{ attempts: AttemptDetailRow[]; questions: QuizQuestionBrief[] }> {
  const session = await auth();
  if (!session?.user?.id) return { attempts: [], questions: [] };
  const role = session.user.role as UserRole;
  if (!hasMinRole(role, 'TA')) return { attempts: [], questions: [] };

  const [rawAttempts, rawQuestions] = await Promise.all([
    prisma.quizAttempt.findMany({
      where:   { quizId },
      orderBy: { startedAt: 'asc' },
      select: {
        id: true, status: true, startedAt: true, submittedAt: true, score: true, maxScore: true,
        student: { select: { id: true, fullName: true, firstName: true, lastName: true, email: true } },
        answers: { select: { questionId: true, score: true, isCorrect: true } },
      },
    }),
    prisma.quizQuestion.findMany({
      where:   { quizId },
      orderBy: { position: 'asc' },
      select:  { questionId: true, position: true, points: true },
    }),
  ]);

  const attempts: AttemptDetailRow[] = rawAttempts.map((a) => ({
    id:          a.id,
    status:      a.status,
    startedAt:   a.startedAt,
    submittedAt: a.submittedAt,
    score:       a.score,
    maxScore:    a.maxScore,
    student:     a.student,
    answers:     a.answers,
  }));

  const questions: QuizQuestionBrief[] = rawQuestions.map((q) => ({
    questionId: q.questionId,
    position:   q.position,
    points:     q.points ?? 1,
  }));

  return { attempts, questions };
}

// ── Delete attempts (teacher / admin) ─────────────────────────

export async function deleteAttemptsAction(ids: string[]): Promise<ActionResult> {
  if (!ids.length) return { success: false, error: 'Không có bài nào được chọn.' };
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  await prisma.quizAttempt.deleteMany({ where: { id: { in: ids } } });
  return { success: true, message: `Đã xoá ${ids.length} bài làm.` };
}

// ── Grade essay answer (teacher) ───────────────────────────────

export async function gradeEssayAction(
  answerId: string,
  score:    number,
  feedback: string | null,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };
  const role = session.user.role as UserRole;
  if (!hasMinRole(role, 'TA')) return { success: false, error: 'Không có quyền.' };

  const answerRow = await prisma.answer.findUnique({
    where: { id: answerId },
    select: {
      attemptId: true,
      attempt:   { select: { quizId: true, quiz: { select: { courseId: true } } } },
    },
  });
  if (!answerRow) return { success: false, error: 'Không tìm thấy câu trả lời.' };

  if (role !== 'ADMIN') {
    const ok = await canManageCourse(session.user.id, role, answerRow.attempt.quiz.courseId);
    if (!ok) return { success: false, error: 'Không có quyền.' };
  }

  await prisma.answer.update({ where: { id: answerId }, data: { score, feedback: feedback ?? null } });

  // Recalculate attempt score
  const allAnswers = await prisma.answer.findMany({
    where:  { attemptId: answerRow.attemptId },
    select: { score: true },
  });
  const totalScore  = allAnswers.reduce((sum, a) => sum + (a.score ?? 0), 0);
  const allGraded   = allAnswers.every((a) => a.score !== null);
  const questionCount = await prisma.quizQuestion.count({ where: { quizId: answerRow.attempt.quizId } });

  await prisma.quizAttempt.update({
    where: { id: answerRow.attemptId },
    data:  {
      score: totalScore,
      ...(allGraded && allAnswers.length >= questionCount ? { status: 'GRADED' } : {}),
    },
  });

  return { success: true, message: 'Đã chấm điểm.' };
}
