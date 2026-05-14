import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import type { AuthUser } from '../../common/auth/auth.types';

const ROLE_ORDER = ['STUDENT', 'TA', 'TEACHER', 'ADMIN', 'SUPERADMIN'] as const;
type Role = (typeof ROLE_ORDER)[number];
function hasMinRole(r: string, min: Role) {
  return ROLE_ORDER.indexOf(r as Role) >= ROLE_ORDER.indexOf(min);
}

@Injectable()
export class GradebookService {
  constructor(private readonly prisma: PrismaClient) {}

  async get(user: AuthUser, courseId: string) {
    if (!hasMinRole(user.role, 'TA')) throw new ForbiddenException('Không có quyền.');

    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId, status: 'ACTIVE' },
      include: {
        user: {
          select: { id: true, fullName: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });
    const studentIds = enrollments.map((e) => e.userId);

    const assignments = await this.prisma.assignment.findMany({
      where: { courseId, status: 'PUBLISHED', deletedAt: null },
      select: { id: true, title: true, maxScore: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
    });

    const quizzes = await this.prisma.quiz.findMany({
      where: { courseId, status: 'PUBLISHED', deletedAt: null },
      select: {
        id: true,
        title: true,
        questions: { select: { points: true, question: { select: { points: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const allSubs = await this.prisma.submission.findMany({
      where: {
        assignmentId: { in: assignments.map((a) => a.id) },
        studentId: { in: studentIds },
        status: { in: ['GRADED', 'SUBMITTED'] },
      },
      select: { assignmentId: true, studentId: true, score: true, status: true },
    });

    type ScoreCell = { score: number | null; maxScore: number; status: string };
    const subMap = new Map<string, Map<string, ScoreCell>>();
    for (const s of allSubs) {
      if (!subMap.has(s.studentId)) subMap.set(s.studentId, new Map());
      const byA = subMap.get(s.studentId)!;
      const prev = byA.get(s.assignmentId);
      const maxScore = assignments.find((a) => a.id === s.assignmentId)?.maxScore ?? 100;
      if (!prev || (s.score ?? -1) > (prev.score ?? -1)) {
        byA.set(s.assignmentId, { score: s.score, maxScore, status: s.status });
      }
    }

    const allAttempts = await this.prisma.quizAttempt.findMany({
      where: {
        quizId: { in: quizzes.map((q) => q.id) },
        studentId: { in: studentIds },
        status: { in: ['GRADED', 'SUBMITTED'] },
      },
      select: { quizId: true, studentId: true, score: true, maxScore: true, status: true },
    });

    const attemptMap = new Map<string, Map<string, ScoreCell>>();
    for (const a of allAttempts) {
      if (!attemptMap.has(a.studentId)) attemptMap.set(a.studentId, new Map());
      const byQ = attemptMap.get(a.studentId)!;
      const prev = byQ.get(a.quizId);
      const quiz = quizzes.find((q) => q.id === a.quizId)!;
      const maxScore = quiz.questions.reduce((s, qq) => s + (qq.points ?? qq.question.points), 0);
      if (!prev || (a.score ?? -1) > (prev.score ?? -1)) {
        byQ.set(a.quizId, { score: a.score, maxScore: a.maxScore ?? maxScore, status: a.status });
      }
    }

    const columns = [
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

    const students = enrollments.map((e) => {
      const u = e.user;
      const name = u.fullName ?? (`${u.firstName} ${u.lastName}`.trim() || u.email);
      const aSubs = subMap.get(e.userId) ?? new Map<string, ScoreCell>();
      const aAtts = attemptMap.get(e.userId) ?? new Map<string, ScoreCell>();

      const scores: Record<string, ScoreCell | null> = {};
      for (const a of assignments) scores[a.id] = aSubs.get(a.id) ?? null;
      for (const q of quizzes) scores[q.id] = aAtts.get(q.id) ?? null;

      return { id: e.userId, name, email: u.email, scores };
    });

    return { courseId, columns, students };
  }
}
