import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import { COMPETENCY_LEVELS, COMPETENCY_LEVEL_SCORE, EVIDENCE_TYPE_LABEL } from '@lumibach/types';
import type {
  ActivityType,
  CompetencyAssessmentItem,
  CompetencyCategoryItem,
  CompetencyEvidenceRow,
  CompetencyIndicatorItem,
  CompetencyLevelValue,
  CompetencyStats,
  CourseCompetencyCatalog,
  CreateCompetencyCategoryBody,
  CreateCompetencyIndicatorBody,
  SetActivityCompetenciesBody,
  UpdateCompetencyCategoryBody,
  UpdateCompetencyIndicatorBody,
  UpsertCompetencyAssessmentBody,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';

type ActivityFk =
  | { assignmentId: string }
  | { quizId: string }
  | { codeExerciseId: string }
  | { practiceTestId: string };

const EMPTY_LEVEL_COUNTS = (): Record<CompetencyLevelValue, number> =>
  Object.fromEntries(COMPETENCY_LEVELS.map((l) => [l.value, 0])) as Record<
    CompetencyLevelValue,
    number
  >;

const ACHIEVED_MIN_SCORE = 3; // Thành thạo (PROFICIENT) trở lên được tính là "đạt"

@Injectable()
export class CompetenciesService {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Permission helpers ───────────────────────────────────────

  private async getCourseAccess(
    user: AuthUser,
    courseId: string
  ): Promise<{ canManage: boolean; canGrade: boolean }> {
    if (user.role === 'ADMIN') return { canManage: true, canGrade: true };

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { ownerId: true },
    });
    if (!course) throw new NotFoundException('Khoá học không tồn tại.');

    if (user.role === 'TEACHER' && course.ownerId === user.id)
      return { canManage: true, canGrade: true };

    const coTeacher = await this.prisma.courseCoTeacher.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
      select: { id: true },
    });
    if (coTeacher) return { canManage: true, canGrade: true };

    const ta = await this.prisma.teachingAssistant.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
      select: { id: true },
    });
    if (ta) return { canManage: false, canGrade: true };

    return { canManage: false, canGrade: false };
  }

  private async assertManage(user: AuthUser, courseId: string): Promise<void> {
    const { canManage } = await this.getCourseAccess(user, courseId);
    if (!canManage) throw new ForbiddenException('Không có quyền quản lý năng lực khoá học này.');
  }

  private async assertGrade(user: AuthUser, courseId: string): Promise<void> {
    const { canGrade } = await this.getCourseAccess(user, courseId);
    if (!canGrade) throw new ForbiddenException('Không có quyền chấm năng lực khoá học này.');
  }

  // ── Activity resolution (đa hình) ────────────────────────────

  private activityFk(type: ActivityType, id: string): ActivityFk {
    switch (type) {
      case 'assignment':
        return { assignmentId: id };
      case 'quiz':
        return { quizId: id };
      case 'code-exercise':
        return { codeExerciseId: id };
      case 'practice-test':
        return { practiceTestId: id };
    }
  }

  private async getActivityCourse(
    type: ActivityType,
    id: string
  ): Promise<{ courseId: string; title: string }> {
    const map = {
      assignment: () =>
        this.prisma.assignment.findUnique({
          where: { id },
          select: { courseId: true, title: true },
        }),
      quiz: () =>
        this.prisma.quiz.findUnique({ where: { id }, select: { courseId: true, title: true } }),
      'code-exercise': () =>
        this.prisma.codeExercise.findUnique({
          where: { id },
          select: { courseId: true, title: true },
        }),
      'practice-test': () =>
        this.prisma.practiceTest.findUnique({
          where: { id },
          select: { courseId: true, title: true },
        }),
    } as const;
    const row = await map[type]();
    if (!row) throw new NotFoundException('Hoạt động học tập không tồn tại.');
    return row;
  }

  // ── Catalog (danh mục + chỉ báo) ─────────────────────────────

  async getCatalog(user: AuthUser, courseId: string): Promise<CourseCompetencyCatalog> {
    await this.assertGrade(user, courseId);

    const categories = await this.prisma.competencyCategory.findMany({
      where: { courseId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        indicators: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    return {
      categories: categories.map(
        (c): CompetencyCategoryItem => ({
          id: c.id,
          courseId: c.courseId,
          name: c.name,
          description: c.description,
          position: c.position,
          indicators: c.indicators.map(this.toIndicatorItem),
        })
      ),
    };
  }

  async createCategory(
    user: AuthUser,
    courseId: string,
    body: CreateCompetencyCategoryBody
  ): Promise<CompetencyCategoryItem> {
    await this.assertManage(user, courseId);

    const last = await this.prisma.competencyCategory.findFirst({
      where: { courseId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const created = await this.prisma.competencyCategory.create({
      data: {
        courseId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        position: (last?.position ?? -1) + 1,
      },
      include: { indicators: true },
    });

    return {
      id: created.id,
      courseId: created.courseId,
      name: created.name,
      description: created.description,
      position: created.position,
      indicators: [],
    };
  }

  async updateCategory(
    user: AuthUser,
    id: string,
    body: UpdateCompetencyCategoryBody
  ): Promise<{ message: string }> {
    const cat = await this.prisma.competencyCategory.findUnique({
      where: { id },
      select: { courseId: true },
    });
    if (!cat) throw new NotFoundException('Danh mục năng lực không tồn tại.');
    await this.assertManage(user, cat.courseId);

    await this.prisma.competencyCategory.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
        ...(body.position !== undefined && { position: body.position }),
      },
    });
    return { message: 'Đã cập nhật danh mục năng lực.' };
  }

  async deleteCategory(user: AuthUser, id: string): Promise<{ message: string }> {
    const cat = await this.prisma.competencyCategory.findUnique({
      where: { id },
      select: { courseId: true },
    });
    if (!cat) throw new NotFoundException('Danh mục năng lực không tồn tại.');
    await this.assertManage(user, cat.courseId);

    await this.prisma.competencyCategory.delete({ where: { id } });
    return { message: 'Đã xoá danh mục năng lực.' };
  }

  async createIndicator(
    user: AuthUser,
    categoryId: string,
    body: CreateCompetencyIndicatorBody
  ): Promise<CompetencyIndicatorItem> {
    const cat = await this.prisma.competencyCategory.findUnique({
      where: { id: categoryId },
      select: { courseId: true },
    });
    if (!cat) throw new NotFoundException('Danh mục năng lực không tồn tại.');
    await this.assertManage(user, cat.courseId);

    const last = await this.prisma.competencyIndicator.findFirst({
      where: { categoryId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const created = await this.prisma.competencyIndicator.create({
      data: {
        categoryId,
        code: body.code?.trim() || null,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        position: (last?.position ?? -1) + 1,
      },
    });
    return this.toIndicatorItem(created);
  }

  async updateIndicator(
    user: AuthUser,
    id: string,
    body: UpdateCompetencyIndicatorBody
  ): Promise<{ message: string }> {
    const ind = await this.prisma.competencyIndicator.findUnique({
      where: { id },
      select: { category: { select: { courseId: true } } },
    });
    if (!ind) throw new NotFoundException('Chỉ báo năng lực không tồn tại.');
    await this.assertManage(user, ind.category.courseId);

    await this.prisma.competencyIndicator.update({
      where: { id },
      data: {
        ...(body.code !== undefined && { code: body.code?.trim() || null }),
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
        ...(body.position !== undefined && { position: body.position }),
      },
    });
    return { message: 'Đã cập nhật chỉ báo năng lực.' };
  }

  async deleteIndicator(user: AuthUser, id: string): Promise<{ message: string }> {
    const ind = await this.prisma.competencyIndicator.findUnique({
      where: { id },
      select: { category: { select: { courseId: true } } },
    });
    if (!ind) throw new NotFoundException('Chỉ báo năng lực không tồn tại.');
    await this.assertManage(user, ind.category.courseId);

    await this.prisma.competencyIndicator.delete({ where: { id } });
    return { message: 'Đã xoá chỉ báo năng lực.' };
  }

  // ── Activity links + assessments ─────────────────────────────

  async getActivityState(
    user: AuthUser,
    type: ActivityType,
    activityId: string
  ): Promise<{ indicators: CompetencyIndicatorItem[]; assessments: CompetencyAssessmentItem[] }> {
    const { courseId } = await this.getActivityCourse(type, activityId);
    await this.assertGrade(user, courseId);

    const fk = this.activityFk(type, activityId);

    const [links, assessments] = await Promise.all([
      this.prisma.activityCompetency.findMany({
        where: fk,
        include: { indicator: true },
      }),
      this.prisma.competencyAssessment.findMany({
        where: fk,
        orderBy: { gradedAt: 'desc' },
      }),
    ]);

    const indicators = links
      .map((l) => this.toIndicatorItem(l.indicator))
      .sort((a, b) => a.position - b.position);

    return {
      indicators,
      assessments: assessments.map(this.toAssessmentItem),
    };
  }

  async setActivityCompetencies(
    user: AuthUser,
    body: SetActivityCompetenciesBody
  ): Promise<{ message: string }> {
    const { courseId } = await this.getActivityCourse(body.activityType, body.activityId);
    await this.assertManage(user, courseId);

    // Chỉ chấp nhận chỉ báo thuộc khoá học này.
    const requestedIds = [...new Set(body.indicatorIds)];
    const valid = await this.prisma.competencyIndicator.findMany({
      where: { id: { in: requestedIds }, category: { courseId } },
      select: { id: true },
    });
    const validIds = new Set(valid.map((v) => v.id));
    const indicatorIds = requestedIds.filter((id) => validIds.has(id));

    const fk = this.activityFk(body.activityType, body.activityId);

    await this.prisma.$transaction(async (tx) => {
      await tx.activityCompetency.deleteMany({ where: fk });
      if (indicatorIds.length > 0) {
        await tx.activityCompetency.createMany({
          data: indicatorIds.map((indicatorId) => ({ indicatorId, ...fk })),
          skipDuplicates: true,
        });
      }
    });

    return { message: 'Đã cập nhật chỉ báo năng lực cho hoạt động.' };
  }

  async upsertAssessment(
    user: AuthUser,
    body: UpsertCompetencyAssessmentBody
  ): Promise<CompetencyAssessmentItem> {
    const { courseId } = await this.getActivityCourse(body.activityType, body.activityId);
    await this.assertGrade(user, courseId);

    const indicator = await this.prisma.competencyIndicator.findFirst({
      where: { id: body.indicatorId, category: { courseId } },
      select: { id: true },
    });
    if (!indicator) throw new NotFoundException('Chỉ báo năng lực không thuộc khoá học.');

    const student = await this.prisma.user.findFirst({
      where: {
        id: body.studentId,
        role: 'STUDENT',
        enrollments: { some: { courseId } },
      },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Học sinh không thuộc khoá học này.');

    const fk = this.activityFk(body.activityType, body.activityId);
    const evidenceType =
      body.evidenceType && EVIDENCE_TYPE_LABEL[body.evidenceType] ? body.evidenceType : null;
    const data = {
      level: body.level,
      evidenceType,
      note: body.note?.trim() || null,
      gradedBy: user.id,
      gradedAt: new Date(),
    };
    const create = {
      indicatorId: body.indicatorId,
      studentId: body.studentId,
      ...data,
      ...fk,
    };

    const saved =
      body.activityType === 'assignment'
        ? await this.prisma.competencyAssessment.upsert({
            where: {
              indicatorId_studentId_assignmentId: {
                indicatorId: body.indicatorId,
                studentId: body.studentId,
                assignmentId: body.activityId,
              },
            },
            update: data,
            create,
          })
        : body.activityType === 'quiz'
          ? await this.prisma.competencyAssessment.upsert({
              where: {
                indicatorId_studentId_quizId: {
                  indicatorId: body.indicatorId,
                  studentId: body.studentId,
                  quizId: body.activityId,
                },
              },
              update: data,
              create,
            })
          : body.activityType === 'code-exercise'
            ? await this.prisma.competencyAssessment.upsert({
                where: {
                  indicatorId_studentId_codeExerciseId: {
                    indicatorId: body.indicatorId,
                    studentId: body.studentId,
                    codeExerciseId: body.activityId,
                  },
                },
                update: data,
                create,
              })
            : await this.prisma.competencyAssessment.upsert({
                where: {
                  indicatorId_studentId_practiceTestId: {
                    indicatorId: body.indicatorId,
                    studentId: body.studentId,
                    practiceTestId: body.activityId,
                  },
                },
                update: data,
                create,
              });

    return this.toAssessmentItem(saved);
  }

  async deleteAssessment(user: AuthUser, id: string): Promise<{ message: string }> {
    const assessment = await this.prisma.competencyAssessment.findUnique({
      where: { id },
      select: { indicator: { select: { category: { select: { courseId: true } } } } },
    });
    if (!assessment) throw new NotFoundException('Đánh giá năng lực không tồn tại.');
    await this.assertGrade(user, assessment.indicator.category.courseId);

    await this.prisma.competencyAssessment.delete({ where: { id } });
    return { message: 'Đã xoá đánh giá năng lực.' };
  }

  // ── Hồ sơ minh chứng của 1 học sinh (Phase 3 dùng lại) ────────

  async getStudentEvidence(
    user: AuthUser,
    courseId: string,
    studentId: string
  ): Promise<CompetencyEvidenceRow[]> {
    const isSelf = user.id === studentId;
    if (!isSelf) {
      const { canGrade } = await this.getCourseAccess(user, courseId);
      if (!canGrade) throw new ForbiddenException('Không có quyền xem hồ sơ năng lực.');
    }

    const [rows, modules] = await Promise.all([
      this.prisma.competencyAssessment.findMany({
        where: { studentId, indicator: { category: { courseId } } },
        orderBy: { gradedAt: 'desc' },
        include: {
          indicator: {
            select: { id: true, name: true, code: true, category: { select: { name: true } } },
          },
          assignment: { select: { title: true } },
          quiz: { select: { title: true } },
          codeExercise: { select: { title: true, language: true } },
          practiceTest: { select: { title: true } },
        },
      }),
      this.prisma.module.findMany({
        where: { courseId },
        select: {
          id: true,
          name: true,
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
    ]);

    // Tra cứu bài làm tốt nhất của HS cho từng quiz / practice-test để link trực tiếp.
    const quizIds = [...new Set(rows.filter((r) => r.quizId).map((r) => r.quizId!))];
    const practiceIds = [
      ...new Set(rows.filter((r) => r.practiceTestId).map((r) => r.practiceTestId!)),
    ];
    const [quizAttempts, practiceAttempts] = await Promise.all([
      quizIds.length > 0
        ? this.prisma.quizAttempt.findMany({
            where: { studentId, quizId: { in: quizIds }, status: { in: ['SUBMITTED', 'GRADED'] } },
            select: { id: true, quizId: true, score: true, submittedAt: true },
          })
        : Promise.resolve(
            [] as {
              id: string;
              quizId: string;
              score: number | null;
              submittedAt: Date | null;
            }[]
          ),
      practiceIds.length > 0
        ? this.prisma.practiceTestAttempt.findMany({
            where: {
              studentId,
              practiceTestId: { in: practiceIds },
              status: { in: ['SUBMITTED', 'GRADED'] },
            },
            select: { id: true, practiceTestId: true, score: true, submittedAt: true },
          })
        : Promise.resolve(
            [] as {
              id: string;
              practiceTestId: string;
              score: number | null;
              submittedAt: Date | null;
            }[]
          ),
    ]);

    function pickBest<T extends { id: string; score: number | null; submittedAt: Date | null }>(
      attempts: T[]
    ): string | undefined {
      if (attempts.length === 0) return undefined;
      const sorted = [...attempts].sort((a, b) => {
        const aScore = a.score ?? -1;
        const bScore = b.score ?? -1;
        if (aScore !== bScore) return bScore - aScore;
        return (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0);
      });
      return sorted[0]!.id;
    }
    const bestQuizAttemptId = new Map<string, string>();
    for (const qid of quizIds) {
      const id = pickBest(quizAttempts.filter((a) => a.quizId === qid));
      if (id) bestQuizAttemptId.set(qid, id);
    }
    const bestPracticeAttemptId = new Map<string, string>();
    for (const pid of practiceIds) {
      const id = pickBest(practiceAttempts.filter((a) => a.practiceTestId === pid));
      if (id) bestPracticeAttemptId.set(pid, id);
    }

    // Map activity → (moduleId, moduleName) để gắn module vào từng dòng evidence.
    const activityToModule = new Map<string, { id: string; name: string }>();
    for (const m of modules) {
      for (const item of m.items) {
        const meta = { id: m.id, name: m.name };
        if (item.assignmentId) activityToModule.set(`assignment:${item.assignmentId}`, meta);
        if (item.quizId) activityToModule.set(`quiz:${item.quizId}`, meta);
        if (item.codeExerciseId) activityToModule.set(`code-exercise:${item.codeExerciseId}`, meta);
        if (item.practiceTestId) activityToModule.set(`practice-test:${item.practiceTestId}`, meta);
      }
    }

    return rows.map((r): CompetencyEvidenceRow => {
      const { activityType, activityId, activityTitle } = this.resolveActivity(r);
      const mod = activityToModule.get(`${activityType}:${activityId}`) ?? null;

      // Đường dẫn xem trực tiếp bài làm/lần làm của HS.
      let viewerPath: string | null = null;
      if (activityType === 'assignment') {
        // Trang submissions hỗ trợ ?student=… để focus thẳng vào bài của HS.
        viewerPath = `/assignments/${activityId}/submissions?student=${studentId}`;
      } else if (activityType === 'quiz') {
        const attemptId = bestQuizAttemptId.get(activityId);
        viewerPath = attemptId ? `/quizzes/${activityId}/attempt/${attemptId}` : null;
      } else if (activityType === 'code-exercise') {
        // /exercises hoặc /scratch tuỳ language. Teacher panel ở trang chính hiển
        // thị danh sách bài nộp của tất cả HS — đủ để xem bài của HS này.
        const lang = r.codeExercise?.language;
        viewerPath = lang === 'SCRATCH' ? `/scratch/${activityId}` : `/exercises/${activityId}`;
      } else if (activityType === 'practice-test') {
        const attemptId = bestPracticeAttemptId.get(activityId);
        viewerPath = attemptId ? `/practice-tests/${activityId}/attempt/${attemptId}` : null;
      }

      return {
        assessmentId: r.id,
        activityType,
        activityId,
        activityTitle,
        categoryName: r.indicator.category.name,
        indicatorId: r.indicator.id,
        indicatorName: r.indicator.name,
        indicatorCode: r.indicator.code,
        level: r.level as CompetencyLevelValue,
        evidenceType: r.evidenceType,
        note: r.note,
        gradedAt: r.gradedAt.toISOString(),
        moduleId: mod?.id ?? null,
        moduleName: mod?.name ?? null,
        viewerPath,
      };
    });
  }

  // ── Thống kê toàn khoá ───────────────────────────────────────

  async getStats(user: AuthUser, courseId: string): Promise<CompetencyStats> {
    await this.assertGrade(user, courseId);

    const [categories, assessments, enrollments] = await Promise.all([
      this.prisma.competencyCategory.findMany({
        where: { courseId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include: { indicators: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } },
      }),
      this.prisma.competencyAssessment.findMany({
        where: { indicator: { category: { courseId } } },
        include: {
          indicator: {
            select: { id: true, name: true, code: true, categoryId: true },
          },
          student: {
            select: { id: true, fullName: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.enrollment.findMany({
        where: { courseId, status: 'ACTIVE', user: { role: 'STUDENT' } },
        select: {
          user: {
            select: { id: true, fullName: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: [{ user: { fullName: 'asc' } }, { user: { email: 'asc' } }],
      }),
    ]);

    const categoryName = new Map<string, string>();
    const indicatorMeta = new Map<
      string,
      { name: string; code: string | null; categoryId: string; categoryName: string }
    >();
    let totalIndicators = 0;
    for (const c of categories) {
      categoryName.set(c.id, c.name);
      for (const ind of c.indicators) {
        totalIndicators++;
        indicatorMeta.set(ind.id, {
          name: ind.name,
          code: ind.code,
          categoryId: c.id,
          categoryName: c.name,
        });
      }
    }

    // Khởi tạo accumulator cho từng chỉ báo / học sinh / danh mục.
    const indAcc = new Map<
      string,
      {
        counts: Record<CompetencyLevelValue, number>;
        scoreSum: number;
        achieved: number;
        total: number;
      }
    >();
    const studentAcc = new Map<
      string,
      {
        name: string;
        email: string;
        counts: Record<CompetencyLevelValue, number>;
        scoreSum: number;
        achieved: number;
        total: number;
      }
    >();
    const catAcc = new Map<string, { scoreSum: number; total: number }>();
    const evidenceAcc = new Map<string, number>();

    for (const { user: u } of enrollments) {
      studentAcc.set(u.id, {
        name: this.displayName(u),
        email: u.email,
        counts: EMPTY_LEVEL_COUNTS(),
        scoreSum: 0,
        achieved: 0,
        total: 0,
      });
    }

    for (const a of assessments) {
      const level = a.level as CompetencyLevelValue;
      const score = COMPETENCY_LEVEL_SCORE[level] ?? 0;
      const isAchieved = score >= ACHIEVED_MIN_SCORE;

      // indicator
      let ia = indAcc.get(a.indicatorId);
      if (!ia) {
        ia = { counts: EMPTY_LEVEL_COUNTS(), scoreSum: 0, achieved: 0, total: 0 };
        indAcc.set(a.indicatorId, ia);
      }
      ia.counts[level]++;
      ia.scoreSum += score;
      ia.total++;
      if (isAchieved) ia.achieved++;

      // student
      let sa = studentAcc.get(a.studentId);
      if (!sa) {
        sa = {
          name: this.displayName(a.student),
          email: a.student.email,
          counts: EMPTY_LEVEL_COUNTS(),
          scoreSum: 0,
          achieved: 0,
          total: 0,
        };
        studentAcc.set(a.studentId, sa);
      }
      sa.counts[level]++;
      sa.scoreSum += score;
      sa.total++;
      if (isAchieved) sa.achieved++;

      // category
      const meta = indicatorMeta.get(a.indicatorId);
      if (meta) {
        let ca = catAcc.get(meta.categoryId);
        if (!ca) {
          ca = { scoreSum: 0, total: 0 };
          catAcc.set(meta.categoryId, ca);
        }
        ca.scoreSum += score;
        ca.total++;
      }

      // evidence type
      if (a.evidenceType) {
        evidenceAcc.set(a.evidenceType, (evidenceAcc.get(a.evidenceType) ?? 0) + 1);
      }
    }

    const indicators = [...indicatorMeta.entries()].map(([indicatorId, meta]) => {
      const acc = indAcc.get(indicatorId);
      return {
        indicatorId,
        indicatorName: meta.name,
        indicatorCode: meta.code,
        categoryId: meta.categoryId,
        categoryName: meta.categoryName,
        totalAssessments: acc?.total ?? 0,
        achievedCount: acc?.achieved ?? 0,
        averageScore: acc && acc.total > 0 ? acc.scoreSum / acc.total : null,
        levelCounts: acc?.counts ?? EMPTY_LEVEL_COUNTS(),
      };
    });

    const students = [...studentAcc.entries()].map(([studentId, acc]) => ({
      studentId,
      studentName: acc.name,
      email: acc.email,
      totalAssessments: acc.total,
      achievedCount: acc.achieved,
      averageScore: acc.total > 0 ? acc.scoreSum / acc.total : null,
      levelCounts: acc.counts,
    }));

    const catList = categories.map((c) => {
      const acc = catAcc.get(c.id);
      return {
        categoryId: c.id,
        categoryName: c.name,
        totalAssessments: acc?.total ?? 0,
        averageScore: acc && acc.total > 0 ? acc.scoreSum / acc.total : null,
      };
    });

    const evidenceTypes = [...evidenceAcc.entries()]
      .map(([evidenceType, count]) => ({
        evidenceType,
        label: EVIDENCE_TYPE_LABEL[evidenceType] ?? evidenceType,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalIndicators,
      totalStudents: students.length,
      totalAssessments: assessments.length,
      indicators,
      students,
      categories: catList,
      evidenceTypes,
    };
  }

  // ── Mappers ──────────────────────────────────────────────────

  private toIndicatorItem = (i: {
    id: string;
    categoryId: string;
    code: string | null;
    name: string;
    description: string | null;
    position: number;
  }): CompetencyIndicatorItem => ({
    id: i.id,
    categoryId: i.categoryId,
    code: i.code,
    name: i.name,
    description: i.description,
    position: i.position,
  });

  private toAssessmentItem = (a: {
    id: string;
    indicatorId: string;
    studentId: string;
    level: string;
    evidenceType: string | null;
    note: string | null;
    gradedBy: string;
    gradedAt: Date;
  }): CompetencyAssessmentItem => ({
    id: a.id,
    indicatorId: a.indicatorId,
    studentId: a.studentId,
    level: a.level as CompetencyLevelValue,
    evidenceType: a.evidenceType,
    note: a.note,
    gradedBy: a.gradedBy,
    gradedAt: a.gradedAt.toISOString(),
  });

  private resolveActivity(r: {
    assignmentId: string | null;
    quizId: string | null;
    codeExerciseId: string | null;
    practiceTestId: string | null;
    assignment: { title: string } | null;
    quiz: { title: string } | null;
    codeExercise: { title: string } | null;
    practiceTest: { title: string } | null;
  }): { activityType: ActivityType; activityId: string; activityTitle: string } {
    if (r.assignmentId)
      return {
        activityType: 'assignment',
        activityId: r.assignmentId,
        activityTitle: r.assignment?.title ?? 'Bài tập',
      };
    if (r.quizId)
      return { activityType: 'quiz', activityId: r.quizId, activityTitle: r.quiz?.title ?? 'Quiz' };
    if (r.codeExerciseId)
      return {
        activityType: 'code-exercise',
        activityId: r.codeExerciseId,
        activityTitle: r.codeExercise?.title ?? 'Bài code',
      };
    return {
      activityType: 'practice-test',
      activityId: r.practiceTestId ?? '',
      activityTitle: r.practiceTest?.title ?? 'Đề luyện tập',
    };
  }

  private displayName(u: {
    fullName: string | null;
    firstName: string;
    lastName: string;
    email: string;
  }): string {
    return (u.fullName ?? `${u.firstName} ${u.lastName}`.trim()) || u.email;
  }
}
