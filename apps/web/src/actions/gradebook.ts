'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import type { UserRole } from '@lumibach/db';

export type GbScoreCell = {
  score: number | null;
  maxScore: number;
  status: string;
};

export type GbColumn = {
  id: string;
  title: string;
  maxScore: number;
  type: 'ASSIGNMENT' | 'QUIZ';
  slug?: string; // quizId or assignmentId for links
};

export type GbStudent = {
  id: string;
  name: string;
  email: string;
  scores: Record<string, GbScoreCell | null>; // columnId → cell
};

export type GradebookData = {
  courseId: string;
  columns: GbColumn[];
  students: GbStudent[];
};

export async function getGradebookAction(courseId: string): Promise<GradebookData> {
  const session = await auth();
  if (!session?.user?.id) return { courseId, columns: [], students: [] };
  const role = session.user.role as UserRole;
  if (!hasMinRole(role, 'TA')) return { courseId, columns: [], students: [] };

  // ── Enrolled students ────────────────────────────────────────
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId, status: 'ACTIVE' },
    include: {
      user: { select: { id: true, fullName: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
  });
  const studentIds = enrollments.map((e) => e.userId);

  // ── Assignments ──────────────────────────────────────────────
  const assignments = await prisma.assignment.findMany({
    where: { courseId, status: 'PUBLISHED', deletedAt: null },
    select: { id: true, title: true, maxScore: true, dueDate: true },
    orderBy: { dueDate: 'asc' },
  });

  // ── Quizzes with computed maxScore from questions ────────────
  const quizzes = await prisma.quiz.findMany({
    where: { courseId, status: 'PUBLISHED', deletedAt: null },
    select: {
      id: true,
      title: true,
      questions: { select: { points: true, question: { select: { points: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // ── Best submissions per student per assignment ───────────────
  const allSubs = await prisma.submission.findMany({
    where: {
      assignmentId: { in: assignments.map((a) => a.id) },
      studentId: { in: studentIds },
      status: { in: ['GRADED', 'SUBMITTED'] },
    },
    select: { assignmentId: true, studentId: true, score: true, status: true },
  });

  // Best = highest score; fall back to GRADED status preference
  type SubMap = Map<string, Map<string, GbScoreCell>>;
  const subMap: SubMap = new Map();
  for (const s of allSubs) {
    if (!subMap.has(s.studentId)) subMap.set(s.studentId, new Map());
    const byAssignment = subMap.get(s.studentId)!;
    const prev = byAssignment.get(s.assignmentId);
    const maxScore = assignments.find((a) => a.id === s.assignmentId)?.maxScore ?? 100;
    if (!prev || (s.score ?? -1) > (prev.score ?? -1)) {
      byAssignment.set(s.assignmentId, { score: s.score, maxScore, status: s.status });
    }
  }

  // ── Best attempts per student per quiz ───────────────────────
  const allAttempts = await prisma.quizAttempt.findMany({
    where: {
      quizId: { in: quizzes.map((q) => q.id) },
      studentId: { in: studentIds },
      status: { in: ['GRADED', 'SUBMITTED'] },
    },
    select: { quizId: true, studentId: true, score: true, maxScore: true, status: true },
  });

  type AttemptMap = Map<string, Map<string, GbScoreCell>>;
  const attemptMap: AttemptMap = new Map();
  for (const a of allAttempts) {
    if (!attemptMap.has(a.studentId)) attemptMap.set(a.studentId, new Map());
    const byQuiz = attemptMap.get(a.studentId)!;
    const prev = byQuiz.get(a.quizId);
    const quiz = quizzes.find((q) => q.id === a.quizId)!;
    const maxScore = quiz.questions.reduce((s, qq) => s + (qq.points ?? qq.question.points), 0);
    if (!prev || (a.score ?? -1) > (prev.score ?? -1)) {
      byQuiz.set(a.quizId, { score: a.score, maxScore: a.maxScore ?? maxScore, status: a.status });
    }
  }

  // ── Build columns ────────────────────────────────────────────
  const columns: GbColumn[] = [
    ...assignments.map((a) => ({
      id: a.id,
      title: a.title,
      maxScore: a.maxScore,
      type: 'ASSIGNMENT' as const,
    })),
    ...quizzes.map((q) => {
      const maxScore = q.questions.reduce((s, qq) => s + (qq.points ?? qq.question.points), 0);
      return { id: q.id, title: q.title, maxScore, type: 'QUIZ' as const };
    }),
  ];

  // ── Build student rows ───────────────────────────────────────
  const students: GbStudent[] = enrollments.map((e) => {
    const u = e.user;
    const name = u.fullName ?? (`${u.firstName} ${u.lastName}`.trim() || u.email);
    const aSubs = subMap.get(e.userId) ?? new Map<string, GbScoreCell>();
    const aAtts = attemptMap.get(e.userId) ?? new Map<string, GbScoreCell>();

    const scores: Record<string, GbScoreCell | null> = {};
    for (const a of assignments) scores[a.id] = aSubs.get(a.id) ?? null;
    for (const q of quizzes) scores[q.id] = aAtts.get(q.id) ?? null;

    return { id: e.userId, name, email: u.email, scores };
  });

  return { courseId, columns, students };
}
