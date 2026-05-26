import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import type {
  CreateReflectionBody,
  PortfolioData,
  PortfolioGradedItem,
  PortfolioReflectionItem,
  UpdateReflectionBody,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';
import { CompetenciesService } from '../competencies/competencies.service';

function bestPer<T>(items: T[], keyOf: (t: T) => string, scoreOf: (t: T) => number | null): T[] {
  const map = new Map<string, T>();
  for (const it of items) {
    const k = keyOf(it);
    const cur = map.get(k);
    if (!cur) {
      map.set(k, it);
      continue;
    }
    if ((scoreOf(it) ?? -1) > (scoreOf(cur) ?? -1)) map.set(k, it);
  }
  return [...map.values()];
}

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly competencies: CompetenciesService
  ) {}

  private async assertStaff(user: AuthUser, courseId: string): Promise<void> {
    if (user.role === 'ADMIN') return;
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { ownerId: true },
    });
    if (!course) throw new NotFoundException('Khoá học không tồn tại.');
    if (user.role === 'TEACHER' && course.ownerId === user.id) return;
    const coTeacher = await this.prisma.courseCoTeacher.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
      select: { id: true },
    });
    if (coTeacher) return;
    const ta = await this.prisma.teachingAssistant.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
      select: { id: true },
    });
    if (ta) return;
    throw new ForbiddenException('Không có quyền xem hồ sơ học tập này.');
  }

  async getPortfolio(user: AuthUser, courseId: string, studentId: string): Promise<PortfolioData> {
    const isSelf = user.id === studentId;
    if (!isSelf) await this.assertStaff(user, courseId);

    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, firstName: true, lastName: true, email: true },
    });
    if (!student) throw new NotFoundException('Học sinh không tồn tại.');

    const [subs, codeSubs, quizAttempts, practiceAttempts, reflections, competencyEvidence] =
      await Promise.all([
        this.prisma.submission.findMany({
          where: {
            studentId,
            status: { not: 'DRAFT' },
            assignment: { courseId, deletedAt: null },
          },
          include: { assignment: { select: { id: true, title: true, maxScore: true } } },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.codeSubmission.findMany({
          where: { studentId, codeExercise: { courseId, deletedAt: null } },
          include: { codeExercise: { select: { id: true, title: true } } },
          orderBy: { submittedAt: 'desc' },
        }),
        this.prisma.quizAttempt.findMany({
          where: {
            studentId,
            status: { in: ['SUBMITTED', 'GRADED'] },
            quiz: { courseId, deletedAt: null },
          },
          include: { quiz: { select: { id: true, title: true } } },
          orderBy: { submittedAt: 'desc' },
        }),
        this.prisma.practiceTestAttempt.findMany({
          where: { studentId, practiceTest: { courseId, deletedAt: null } },
          include: { practiceTest: { select: { id: true, title: true } } },
          orderBy: { submittedAt: 'desc' },
        }),
        this.prisma.portfolioReflection.findMany({
          where: { courseId, studentId },
          orderBy: { createdAt: 'desc' },
        }),
        this.competencies.getStudentEvidence(user, courseId, studentId),
      ]);

    const gradedItems: PortfolioGradedItem[] = [
      ...subs.map(
        (s): PortfolioGradedItem => ({
          id: s.id,
          activityType: 'assignment',
          activityId: s.assignmentId,
          title: s.assignment.title,
          score: s.score,
          maxScore: s.assignment.maxScore,
          status: s.status,
          feedback: s.feedback,
          date: (s.gradedAt ?? s.submittedAt)?.toISOString() ?? null,
        })
      ),
      ...bestPer(
        codeSubs,
        (c) => c.codeExerciseId,
        (c) => c.score
      ).map(
        (c): PortfolioGradedItem => ({
          id: c.id,
          activityType: 'code-exercise',
          activityId: c.codeExerciseId,
          title: c.codeExercise.title,
          score: c.score,
          maxScore: c.maxScore,
          status: c.status,
          feedback: c.feedback,
          date: (c.gradedAt ?? c.submittedAt)?.toISOString() ?? null,
        })
      ),
      ...bestPer(
        quizAttempts,
        (q) => q.quizId,
        (q) => q.score
      ).map(
        (q): PortfolioGradedItem => ({
          id: q.id,
          activityType: 'quiz',
          activityId: q.quizId,
          title: q.quiz.title,
          score: q.score,
          maxScore: q.maxScore,
          status: q.status,
          feedback: null,
          date: q.submittedAt?.toISOString() ?? null,
        })
      ),
      ...bestPer(
        practiceAttempts,
        (p) => p.practiceTestId,
        (p) => p.score
      ).map(
        (p): PortfolioGradedItem => ({
          id: p.id,
          activityType: 'practice-test',
          activityId: p.practiceTestId,
          title: p.practiceTest.title,
          score: p.score,
          maxScore: p.maxScore,
          status: p.status,
          feedback: null,
          date: p.submittedAt?.toISOString() ?? null,
        })
      ),
    ];

    const scored = gradedItems.filter(
      (g) => g.score !== null && g.maxScore !== null && g.maxScore > 0
    );
    const averagePercent =
      scored.length > 0
        ? scored.reduce((sum, g) => sum + (g.score! / g.maxScore!) * 100, 0) / scored.length
        : null;

    return {
      student: {
        id: student.id,
        name:
          (student.fullName ?? `${student.firstName} ${student.lastName}`.trim()) || student.email,
        email: student.email,
      },
      canEdit: isSelf,
      summary: {
        totalGraded: gradedItems.length,
        averagePercent,
        competencyCount: competencyEvidence.length,
        reflectionCount: reflections.length,
      },
      gradedItems,
      competencyEvidence,
      reflections: reflections.map(this.toReflectionItem),
    };
  }

  // ── Reflections (tự đánh giá) ────────────────────────────────

  async createReflection(
    user: AuthUser,
    courseId: string,
    body: CreateReflectionBody
  ): Promise<PortfolioReflectionItem> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) throw new NotFoundException('Khoá học không tồn tại.');

    const created = await this.prisma.portfolioReflection.create({
      data: {
        courseId,
        studentId: user.id,
        title: body.title.trim(),
        content: body.content.trim(),
      },
    });
    return this.toReflectionItem(created);
  }

  async updateReflection(
    user: AuthUser,
    id: string,
    body: UpdateReflectionBody
  ): Promise<{ message: string }> {
    const r = await this.prisma.portfolioReflection.findUnique({
      where: { id },
      select: { studentId: true },
    });
    if (!r) throw new NotFoundException('Không tìm thấy mục tự đánh giá.');
    if (r.studentId !== user.id) throw new ForbiddenException('Không có quyền sửa.');

    await this.prisma.portfolioReflection.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title.trim() }),
        ...(body.content !== undefined && { content: body.content.trim() }),
      },
    });
    return { message: 'Đã cập nhật tự đánh giá.' };
  }

  async deleteReflection(user: AuthUser, id: string): Promise<{ message: string }> {
    const r = await this.prisma.portfolioReflection.findUnique({
      where: { id },
      select: { studentId: true },
    });
    if (!r) throw new NotFoundException('Không tìm thấy mục tự đánh giá.');
    if (r.studentId !== user.id) throw new ForbiddenException('Không có quyền xoá.');

    await this.prisma.portfolioReflection.delete({ where: { id } });
    return { message: 'Đã xoá tự đánh giá.' };
  }

  private toReflectionItem = (r: {
    id: string;
    title: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
  }): PortfolioReflectionItem => ({
    id: r.id,
    title: r.title,
    content: r.content,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  });
}
