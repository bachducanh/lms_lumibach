import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import { COMPETENCY_LEVEL_SCORE } from '@lumibach/types';
import type {
  CompetencyLevelValue,
  CompetencyMatrixCell,
  CompetencyMatrixData,
  CreateReflectionBody,
  PortfolioData,
  PortfolioGradedItem,
  PortfolioOverview,
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

    const [
      subs,
      codeSubs,
      quizAttempts,
      practiceAttempts,
      reflections,
      competencyEvidence,
      modules,
      catalog,
      assessmentsForMatrix,
    ] = await Promise.all([
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
      this.prisma.module.findMany({
        where: { courseId },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          name: true,
          position: true,
          items: {
            select: {
              assignmentId: true,
              quizId: true,
              codeExerciseId: true,
              practiceTestId: true,
            },
          },
        },
      }),
      this.prisma.competencyCategory.findMany({
        where: { courseId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include: {
          indicators: {
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, code: true, name: true },
          },
        },
      }),
      this.prisma.competencyAssessment.findMany({
        where: { studentId, indicator: { category: { courseId } } },
        select: {
          indicatorId: true,
          level: true,
          assignmentId: true,
          quizId: true,
          codeExerciseId: true,
          practiceTestId: true,
        },
      }),
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

    // ── Matrix năng lực (chỉ báo × module) ──
    const activityToModule = new Map<string, string>();
    for (const m of modules) {
      for (const item of m.items) {
        if (item.assignmentId) activityToModule.set(`assignment:${item.assignmentId}`, m.id);
        if (item.quizId) activityToModule.set(`quiz:${item.quizId}`, m.id);
        if (item.codeExerciseId) activityToModule.set(`code-exercise:${item.codeExerciseId}`, m.id);
        if (item.practiceTestId) activityToModule.set(`practice-test:${item.practiceTestId}`, m.id);
      }
    }
    const cellAgg = new Map<
      string,
      { level: CompetencyLevelValue; score: number; count: number }
    >();
    for (const a of assessmentsForMatrix) {
      let key: string | undefined;
      if (a.assignmentId) key = `assignment:${a.assignmentId}`;
      else if (a.quizId) key = `quiz:${a.quizId}`;
      else if (a.codeExerciseId) key = `code-exercise:${a.codeExerciseId}`;
      else if (a.practiceTestId) key = `practice-test:${a.practiceTestId}`;
      if (!key) continue;
      const moduleId = activityToModule.get(key);
      if (!moduleId) continue;
      const cellKey = `${a.indicatorId}::${moduleId}`;
      const lvl = a.level as CompetencyLevelValue;
      const sc = COMPETENCY_LEVEL_SCORE[lvl] ?? 0;
      const cur = cellAgg.get(cellKey);
      if (!cur || sc > cur.score) {
        cellAgg.set(cellKey, { level: lvl, score: sc, count: (cur?.count ?? 0) + 1 });
      } else {
        cellAgg.set(cellKey, { ...cur, count: cur.count + 1 });
      }
    }
    const matrix: CompetencyMatrixData = {
      modules: modules.map((m) => ({ id: m.id, name: m.name, position: m.position })),
      categories: catalog.map((c) => ({
        id: c.id,
        name: c.name,
        indicators: c.indicators,
      })),
      cells: [...cellAgg.entries()].map(([key, v]): CompetencyMatrixCell => {
        const [indicatorId, moduleId] = key.split('::');
        return { indicatorId: indicatorId!, moduleId: moduleId!, level: v.level, count: v.count };
      }),
    };

    return {
      student: {
        id: student.id,
        name: this.displayName(student),
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
      matrix,
    };
  }

  async getOverview(user: AuthUser, studentId = user.id): Promise<PortfolioOverview> {
    const isSelf = user.id === studentId;
    if (!isSelf && !['ADMIN', 'TEACHER', 'TA'].includes(user.role)) {
      throw new ForbiddenException('Không có quyền xem hồ sơ học tập này.');
    }

    const student = await this.prisma.user.findUnique({
      where: { id: studentId, deletedAt: null },
      select: { id: true, fullName: true, firstName: true, lastName: true, email: true },
    });
    if (!student) throw new NotFoundException('Học sinh không tồn tại.');

    const staffCourseScope =
      user.role === 'ADMIN'
        ? {}
        : user.role === 'TEACHER'
          ? {
              OR: [{ ownerId: user.id }, { coTeachers: { some: { userId: user.id } } }],
            }
          : user.role === 'TA'
            ? { teachingAssistants: { some: { userId: user.id } } }
            : {};

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId: studentId,
        course: {
          deletedAt: null,
          ...(isSelf ? {} : staffCourseScope),
        },
      },
      select: {
        courseId: true,
        status: true,
        progress: true,
        enrolledAt: true,
        course: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    const courses = (
      await Promise.all(
        enrollments.map(async (enrollment) => {
          const portfolio = await this.getPortfolio(user, enrollment.courseId, studentId).catch(
            () => null
          );
          if (!portfolio) return null;
          return {
            courseId: enrollment.course.id,
            courseName: enrollment.course.name,
            courseSlug: enrollment.course.slug,
            status: enrollment.status,
            progress: enrollment.progress,
            enrolledAt: enrollment.enrolledAt.toISOString(),
            summary: portfolio.summary,
          };
        })
      )
    ).filter((course): course is NonNullable<typeof course> => course !== null);

    const averageProgress =
      courses.length > 0
        ? Math.round(courses.reduce((sum, course) => sum + course.progress, 0) / courses.length)
        : 0;

    return {
      student: {
        id: student.id,
        name: this.displayName(student),
        email: student.email,
      },
      totals: {
        courseCount: courses.length,
        averageProgress,
        totalGraded: courses.reduce((sum, course) => sum + course.summary.totalGraded, 0),
        competencyCount: courses.reduce((sum, course) => sum + course.summary.competencyCount, 0),
        reflectionCount: courses.reduce((sum, course) => sum + course.summary.reflectionCount, 0),
      },
      courses,
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

  private displayName(u: {
    fullName: string | null;
    firstName: string;
    lastName: string;
    email: string;
  }): string {
    return (u.fullName ?? `${u.firstName} ${u.lastName}`.trim()) || u.email;
  }
}
