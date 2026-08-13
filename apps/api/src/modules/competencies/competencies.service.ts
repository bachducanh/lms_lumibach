import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import {
  COMPETENCY_LEVELS,
  COMPETENCY_LEVEL_SCORE,
  EVIDENCE_TYPE_LABEL,
  learningPaceFromRate,
} from '@lumibach/types';
import type {
  ActivityCompetencyIndicatorItem,
  ActivityType,
  CompetencyAssessmentItem,
  CompetencyCategoryItem,
  CompetencyCategoryLevelRow,
  CompetencyComponentItem,
  CompetencyComponentLevelRow,
  CompetencyEvidenceRow,
  CompetencyExportData,
  CompetencyIndicatorItem,
  CompetencyLevelValue,
  CompetencyPeriod,
  CompetencyPeriodGrid,
  CompetencyStats,
  CourseCompetencyCatalog,
  CreateCompetencyCategoryBody,
  CreateCompetencyComponentBody,
  CreateCompetencyIndicatorBody,
  CreateCompetencyPeriodBody,
  ImportCompetenciesBody,
  ImportCompetenciesResult,
  ImportCompetencyRow,
  SetActivityCompetenciesBody,
  UpdateCompetencyCategoryBody,
  UpdateCompetencyComponentBody,
  UpdateCompetencyIndicatorBody,
  UpdateCompetencyPeriodBody,
  UpsertActivityCompetencyRubricBody,
  UpsertCompetencyAssessmentBody,
  UpsertCompetencyLevelTargetBody,
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

// Mức tối thiểu được tính là "thành thạo" cho quy tắc hoàn thành chỉ báo.
const MASTERED_LEVELS: readonly CompetencyLevelValue[] = ['PROFICIENT', 'ADVANCED'];
// Số minh chứng tối thiểu đạt mức thành thạo trở lên để 1 chỉ báo được tính "hoàn thành".
const INDICATOR_COMPLETION_MIN_EVIDENCE = 2;

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
        components: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          include: {
            indicators: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
          },
        },
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
          components: c.components.map(this.toComponentItem),
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
    });

    return {
      id: created.id,
      courseId: created.courseId,
      name: created.name,
      description: created.description,
      position: created.position,
      components: [],
    };
  }

  async createComponent(
    user: AuthUser,
    categoryId: string,
    body: CreateCompetencyComponentBody
  ): Promise<CompetencyComponentItem> {
    const cat = await this.prisma.competencyCategory.findUnique({
      where: { id: categoryId },
      select: { courseId: true },
    });
    if (!cat) throw new NotFoundException('Danh mục năng lực không tồn tại.');
    await this.assertManage(user, cat.courseId);

    const last = await this.prisma.competencyComponent.findFirst({
      where: { categoryId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const created = await this.prisma.competencyComponent.create({
      data: {
        categoryId,
        code: body.code?.trim() || null,
        name: body.name.trim(),
        position: (last?.position ?? -1) + 1,
      },
      include: { indicators: true },
    });

    return this.toComponentItem(created);
  }

  async updateComponent(
    user: AuthUser,
    id: string,
    body: UpdateCompetencyComponentBody
  ): Promise<{ message: string }> {
    const comp = await this.prisma.competencyComponent.findUnique({
      where: { id },
      select: { category: { select: { courseId: true } } },
    });
    if (!comp) throw new NotFoundException('Thành phần năng lực không tồn tại.');
    await this.assertManage(user, comp.category.courseId);

    await this.prisma.competencyComponent.update({
      where: { id },
      data: {
        ...(body.code !== undefined && { code: body.code?.trim() || null }),
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.position !== undefined && { position: body.position }),
      },
    });
    return { message: 'Đã cập nhật thành phần năng lực.' };
  }

  async deleteComponent(user: AuthUser, id: string): Promise<{ message: string }> {
    const comp = await this.prisma.competencyComponent.findUnique({
      where: { id },
      select: { category: { select: { courseId: true } } },
    });
    if (!comp) throw new NotFoundException('Thành phần năng lực không tồn tại.');
    await this.assertManage(user, comp.category.courseId);

    await this.prisma.competencyComponent.delete({ where: { id } });
    return { message: 'Đã xoá thành phần năng lực.' };
  }

  /**
   * Import hàng loạt từ Excel.
   *
   * Chạy được nhiều lần trên cùng một file: danh mục trùng tên thì dùng lại,
   * chỉ báo trùng mã (hoặc trùng nội dung khi không có mã) trong cùng danh mục
   * thì bỏ qua. Nhờ vậy giáo viên bổ sung vài dòng vào file cũ rồi đẩy lên lại
   * mà không sinh bản sao.
   */
  async importCatalog(
    user: AuthUser,
    courseId: string,
    body: ImportCompetenciesBody
  ): Promise<ImportCompetenciesResult> {
    await this.assertManage(user, courseId);

    const result: ImportCompetenciesResult = {
      categoriesCreated: 0,
      categoriesReused: 0,
      componentsCreated: 0,
      componentsReused: 0,
      indicatorsCreated: 0,
      indicatorsSkipped: 0,
      errors: [],
    };

    // Gom theo danh mục → thành phần, giữ nguyên thứ tự xuất hiện trong file.
    type ComponentGroup = {
      name: string;
      code?: string;
      rows: { row: number; data: ImportCompetencyRow }[];
    };
    type CategoryGroup = {
      name: string;
      description?: string;
      components: Map<string, ComponentGroup>;
    };
    const grouped = new Map<string, CategoryGroup>();
    body.rows.forEach((data, index) => {
      const categoryName = data.categoryName.trim();
      const categoryKey = categoryName.toLocaleLowerCase('vi');
      const categoryGroup = grouped.get(categoryKey) ?? {
        name: categoryName,
        description: data.categoryDescription,
        components: new Map<string, ComponentGroup>(),
      };
      if (!categoryGroup.description && data.categoryDescription)
        categoryGroup.description = data.categoryDescription;
      grouped.set(categoryKey, categoryGroup);

      const componentName = data.componentName.trim();
      const componentKey = componentName.toLocaleLowerCase('vi');
      const componentGroup = categoryGroup.components.get(componentKey) ?? {
        name: componentName,
        code: data.componentCode,
        rows: [],
      };
      // +2: bỏ qua dòng tiêu đề, và Excel đánh số từ 1.
      componentGroup.rows.push({ row: index + 2, data });
      if (!componentGroup.code && data.componentCode) componentGroup.code = data.componentCode;
      categoryGroup.components.set(componentKey, componentGroup);
    });

    const existingCategories = await this.prisma.competencyCategory.findMany({
      where: { courseId },
      select: { id: true, name: true },
    });
    const categoryByName = new Map(
      existingCategories.map((c) => [c.name.trim().toLocaleLowerCase('vi'), c.id])
    );

    let nextCategoryPosition =
      ((
        await this.prisma.competencyCategory.findFirst({
          where: { courseId },
          orderBy: { position: 'desc' },
          select: { position: true },
        })
      )?.position ?? -1) + 1;

    for (const [categoryKey, categoryGroup] of grouped) {
      let categoryId = categoryByName.get(categoryKey);
      if (categoryId) {
        result.categoriesReused += 1;
      } else {
        const created = await this.prisma.competencyCategory.create({
          data: {
            courseId,
            name: categoryGroup.name,
            description: categoryGroup.description?.trim() || null,
            position: nextCategoryPosition++,
          },
          select: { id: true },
        });
        categoryId = created.id;
        categoryByName.set(categoryKey, categoryId);
        result.categoriesCreated += 1;
      }

      const existingComponents = await this.prisma.competencyComponent.findMany({
        where: { categoryId },
        select: { id: true, name: true, position: true },
      });
      const componentByName = new Map(
        existingComponents.map((c) => [c.name.trim().toLocaleLowerCase('vi'), c.id])
      );
      let nextComponentPosition =
        Math.max(-1, ...existingComponents.map((c) => c.position ?? -1)) + 1;

      for (const [componentKey, componentGroup] of categoryGroup.components) {
        let componentId = componentByName.get(componentKey);
        if (componentId) {
          result.componentsReused += 1;
        } else {
          const created = await this.prisma.competencyComponent.create({
            data: {
              categoryId,
              code: componentGroup.code?.trim() || null,
              name: componentGroup.name,
              position: nextComponentPosition++,
            },
            select: { id: true },
          });
          componentId = created.id;
          componentByName.set(componentKey, componentId);
          result.componentsCreated += 1;
        }

        const existingIndicators = await this.prisma.competencyIndicator.findMany({
          where: { componentId },
          select: { code: true, name: true, position: true },
        });
        const seenCodes = new Set(
          existingIndicators
            .map((i) => i.code?.trim().toLocaleLowerCase('vi'))
            .filter((v): v is string => !!v)
        );
        const seenNames = new Set(
          existingIndicators.map((i) => i.name.trim().toLocaleLowerCase('vi'))
        );
        let indicatorPosition =
          Math.max(-1, ...existingIndicators.map((i) => i.position ?? -1)) + 1;

        for (const { data } of componentGroup.rows) {
          const code = data.code?.trim() || null;
          const name = data.name.trim();
          const codeKey = code?.toLocaleLowerCase('vi');
          const nameKey = name.toLocaleLowerCase('vi');

          if ((codeKey && seenCodes.has(codeKey)) || (!codeKey && seenNames.has(nameKey))) {
            result.indicatorsSkipped += 1;
            continue;
          }

          await this.prisma.competencyIndicator.create({
            data: {
              componentId,
              code,
              name,
              description: data.description?.trim() || null,
              position: indicatorPosition++,
            },
          });
          if (codeKey) seenCodes.add(codeKey);
          seenNames.add(nameKey);
          result.indicatorsCreated += 1;
        }
      }
    }

    return result;
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
    componentId: string,
    body: CreateCompetencyIndicatorBody
  ): Promise<CompetencyIndicatorItem> {
    const comp = await this.prisma.competencyComponent.findUnique({
      where: { id: componentId },
      select: { category: { select: { courseId: true } } },
    });
    if (!comp) throw new NotFoundException('Thành phần năng lực không tồn tại.');
    await this.assertManage(user, comp.category.courseId);

    const last = await this.prisma.competencyIndicator.findFirst({
      where: { componentId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const created = await this.prisma.competencyIndicator.create({
      data: {
        componentId,
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
      select: { component: { select: { category: { select: { courseId: true } } } } },
    });
    if (!ind) throw new NotFoundException('Chỉ báo năng lực không tồn tại.');
    await this.assertManage(user, ind.component.category.courseId);

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
      select: { component: { select: { category: { select: { courseId: true } } } } },
    });
    if (!ind) throw new NotFoundException('Chỉ báo năng lực không tồn tại.');
    await this.assertManage(user, ind.component.category.courseId);

    await this.prisma.competencyIndicator.delete({ where: { id } });
    return { message: 'Đã xoá chỉ báo năng lực.' };
  }

  // ── Kỳ đánh giá năng lực (học kỳ) ─────────────────────────────

  async listPeriods(user: AuthUser, courseId: string): Promise<CompetencyPeriod[]> {
    await this.assertGrade(user, courseId);

    const periods = await this.prisma.competencyAssessmentPeriod.findMany({
      where: { courseId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return periods.map(this.toPeriodItem);
  }

  async createPeriod(
    user: AuthUser,
    courseId: string,
    body: CreateCompetencyPeriodBody
  ): Promise<CompetencyPeriod> {
    await this.assertManage(user, courseId);

    let position = body.position;
    if (position === undefined) {
      const last = await this.prisma.competencyAssessmentPeriod.findFirst({
        where: { courseId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = (last?.position ?? -1) + 1;
    }

    const created = await this.prisma.competencyAssessmentPeriod.create({
      data: {
        courseId,
        name: body.name.trim(),
        position,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
      },
    });
    return this.toPeriodItem(created);
  }

  async updatePeriod(
    user: AuthUser,
    id: string,
    body: UpdateCompetencyPeriodBody
  ): Promise<{ message: string }> {
    const period = await this.prisma.competencyAssessmentPeriod.findUnique({
      where: { id },
      select: { courseId: true },
    });
    if (!period) throw new NotFoundException('Kỳ đánh giá không tồn tại.');
    await this.assertManage(user, period.courseId);

    await this.prisma.competencyAssessmentPeriod.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.position !== undefined && { position: body.position }),
        ...(body.startDate !== undefined && {
          startDate: body.startDate ? new Date(body.startDate) : null,
        }),
        ...(body.endDate !== undefined && {
          endDate: body.endDate ? new Date(body.endDate) : null,
        }),
      },
    });
    return { message: 'Đã cập nhật kỳ đánh giá.' };
  }

  async deletePeriod(user: AuthUser, id: string): Promise<{ message: string }> {
    const period = await this.prisma.competencyAssessmentPeriod.findUnique({
      where: { id },
      select: { courseId: true },
    });
    if (!period) throw new NotFoundException('Kỳ đánh giá không tồn tại.');
    await this.assertManage(user, period.courseId);

    await this.prisma.competencyAssessmentPeriod.delete({ where: { id } });
    return { message: 'Đã xoá kỳ đánh giá.' };
  }

  // ── Cấp độ năng lực xuất phát/đích + điểm năng lực theo kỳ ────

  async upsertLevelTarget(
    user: AuthUser,
    body: UpsertCompetencyLevelTargetBody
  ): Promise<{ message: string }> {
    const period = await this.prisma.competencyAssessmentPeriod.findUnique({
      where: { id: body.periodId },
      select: { courseId: true },
    });
    if (!period) throw new NotFoundException('Kỳ đánh giá không tồn tại.');
    await this.assertGrade(user, period.courseId);

    const component = await this.prisma.competencyComponent.findFirst({
      where: { id: body.componentId, category: { courseId: period.courseId } },
      select: { id: true, categoryId: true },
    });
    if (!component) throw new NotFoundException('Thành phần năng lực không thuộc khoá học.');

    const student = await this.prisma.user.findFirst({
      where: {
        id: body.studentId,
        role: 'STUDENT',
        enrollments: { some: { courseId: period.courseId } },
      },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Học sinh không thuộc khoá học này.');

    await this.prisma.competencyLevelTarget.upsert({
      where: {
        periodId_componentId_studentId: {
          periodId: body.periodId,
          componentId: body.componentId,
          studentId: body.studentId,
        },
      },
      update: { startLevel: body.startLevel, targetLevel: body.targetLevel },
      create: {
        periodId: body.periodId,
        componentId: body.componentId,
        categoryId: component.categoryId,
        studentId: body.studentId,
        startLevel: body.startLevel,
        targetLevel: body.targetLevel,
      },
    });
    return { message: 'Đã cập nhật cấp độ năng lực.' };
  }

  async getPeriodGrid(
    user: AuthUser,
    courseId: string,
    periodId: string
  ): Promise<CompetencyPeriodGrid> {
    await this.assertGrade(user, courseId);

    const period = await this.prisma.competencyAssessmentPeriod.findFirst({
      where: { id: periodId, courseId },
    });
    if (!period) throw new NotFoundException('Kỳ đánh giá không tồn tại.');

    const [categories, enrollments, levelTargets, assessments] = await Promise.all([
      this.prisma.competencyCategory.findMany({
        where: { courseId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include: {
          components: {
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            include: { indicators: { select: { id: true } } },
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
      this.prisma.competencyLevelTarget.findMany({ where: { periodId } }),
      this.prisma.competencyAssessment.findMany({
        where: {
          indicator: { component: { category: { courseId } } },
          ...(period.startDate && period.endDate
            ? { gradedAt: { gte: period.startDate, lte: period.endDate } }
            : {}),
        },
        select: { indicatorId: true, studentId: true, level: true },
      }),
    ]);

    // indicatorId -> componentId, để tra ngược thành phần của 1 minh chứng.
    const indicatorComponent = new Map<string, string>();
    // componentId -> tổng số chỉ báo (mẫu số của tỉ lệ % hoàn thành).
    const componentTotalIndicators = new Map<string, number>();
    for (const c of categories) {
      for (const comp of c.components) {
        componentTotalIndicators.set(comp.id, comp.indicators.length);
        for (const ind of comp.indicators) indicatorComponent.set(ind.id, comp.id);
      }
    }

    // (componentId -> studentId -> indicatorId -> levels[]) để áp dụng quy tắc hoàn thành
    // chỉ báo (≥2 minh chứng Thành thạo/Vượt thành thạo) trước khi tính tỉ lệ % theo thành phần.
    const tally = new Map<string, Map<string, Map<string, CompetencyLevelValue[]>>>();
    for (const a of assessments) {
      const componentId = indicatorComponent.get(a.indicatorId);
      if (!componentId) continue;
      let byStudent = tally.get(componentId);
      if (!byStudent) {
        byStudent = new Map();
        tally.set(componentId, byStudent);
      }
      let byIndicator = byStudent.get(a.studentId);
      if (!byIndicator) {
        byIndicator = new Map();
        byStudent.set(a.studentId, byIndicator);
      }
      const levels = byIndicator.get(a.indicatorId);
      const level = a.level as CompetencyLevelValue;
      if (levels) levels.push(level);
      else byIndicator.set(a.indicatorId, [level]);
    }

    const levelTargetByKey = new Map<string, { startLevel: number; targetLevel: number }>();
    for (const lt of levelTargets) {
      levelTargetByKey.set(`${lt.componentId}::${lt.studentId}`, {
        startLevel: lt.startLevel,
        targetLevel: lt.targetLevel,
      });
    }

    // ── Cấp thành phần: điểm = xuất phát + 2×tỉ lệ hoàn thành CỦA RIÊNG thành phần đó.
    const componentRows: CompetencyComponentLevelRow[] = [];
    for (const { user: student } of enrollments) {
      for (const category of categories) {
        for (const comp of category.components) {
          const totalIndicators = componentTotalIndicators.get(comp.id) ?? 0;
          const byIndicator = tally.get(comp.id)?.get(student.id);
          let completedIndicators = 0;
          if (byIndicator) {
            for (const levels of byIndicator.values()) {
              if (this.isIndicatorCompleted(levels)) completedIndicators++;
            }
          }
          const completionRate = totalIndicators > 0 ? completedIndicators / totalIndicators : null;
          const target = levelTargetByKey.get(`${comp.id}::${student.id}`);

          let competencyScore: number | null = null;
          let growthScore: number | null = null;
          if (target && completionRate !== null) {
            competencyScore = target.startLevel + 2 * completionRate;
            growthScore = competencyScore - target.startLevel;
          }

          componentRows.push({
            studentId: student.id,
            studentName: this.displayName(student),
            componentId: comp.id,
            componentName: comp.name,
            categoryId: category.id,
            categoryName: category.name,
            startLevel: target?.startLevel ?? null,
            targetLevel: target?.targetLevel ?? null,
            completedIndicators,
            totalIndicators,
            completionRate,
            competencyScore,
            growthScore,
            learningPace: completionRate !== null ? learningPaceFromRate(completionRate) : null,
          });
        }
      }
    }

    // ── Cấp danh mục (rollup, chỉ đọc): startLevel/targetLevel/competencyScore =
    // trung bình cộng các thành phần; completionRate = tổng hoàn thành/tổng chỉ báo
    // TOÀN DANH MỤC (gộp phẳng, đúng công thức Z3=Y3/Q3 trong file mẫu, không phải
    // trung bình cộng các tỉ lệ thành phần).
    const categoryRollups: CompetencyCategoryLevelRow[] = [];
    for (const { user: student } of enrollments) {
      for (const category of categories) {
        const rowsOfCategory = componentRows.filter(
          (r) => r.studentId === student.id && r.categoryId === category.id
        );
        const totalIndicators = rowsOfCategory.reduce((sum, r) => sum + r.totalIndicators, 0);
        const completedIndicators = rowsOfCategory.reduce(
          (sum, r) => sum + r.completedIndicators,
          0
        );
        const completionRate = totalIndicators > 0 ? completedIndicators / totalIndicators : null;

        const hasComponents = rowsOfCategory.length > 0;
        const allTargetsSet = hasComponents && rowsOfCategory.every((r) => r.startLevel !== null);
        const startLevel = allTargetsSet
          ? rowsOfCategory.reduce((sum, r) => sum + r.startLevel!, 0) / rowsOfCategory.length
          : null;
        const targetLevel = allTargetsSet
          ? rowsOfCategory.reduce((sum, r) => sum + r.targetLevel!, 0) / rowsOfCategory.length
          : null;
        const scored = rowsOfCategory.filter((r) => r.competencyScore !== null);
        const competencyScore =
          allTargetsSet && scored.length > 0
            ? scored.reduce((sum, r) => sum + r.competencyScore!, 0) / scored.length
            : null;
        const growthScore =
          competencyScore !== null && startLevel !== null ? competencyScore - startLevel : null;

        categoryRollups.push({
          studentId: student.id,
          studentName: this.displayName(student),
          categoryId: category.id,
          categoryName: category.name,
          startLevel,
          targetLevel,
          completedIndicators,
          totalIndicators,
          completionRate,
          competencyScore,
          growthScore,
          learningPace: completionRate !== null ? learningPaceFromRate(completionRate) : null,
        });
      }
    }

    return {
      period: this.toPeriodItem(period),
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
      components: categories.flatMap((c) =>
        c.components.map((comp) => ({ id: comp.id, categoryId: c.id, name: comp.name }))
      ),
      componentRows,
      categoryRollups,
    };
  }

  // ── Activity links + assessments ─────────────────────────────

  async getActivityState(
    user: AuthUser,
    type: ActivityType,
    activityId: string
  ): Promise<{
    indicators: ActivityCompetencyIndicatorItem[];
    assessments: CompetencyAssessmentItem[];
  }> {
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
      .map(
        (l): ActivityCompetencyIndicatorItem => ({
          ...this.toIndicatorItem(l.indicator),
          rubric: {
            noEvidence: l.rubricNoEvidence,
            beginning: l.rubricBeginning,
            approaching: l.rubricApproaching,
            proficient: l.rubricProficient,
            advanced: l.rubricAdvanced,
          },
        })
      )
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
      where: { id: { in: requestedIds }, component: { category: { courseId } } },
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

  async updateActivityCompetencyRubric(
    user: AuthUser,
    body: UpsertActivityCompetencyRubricBody
  ): Promise<{ message: string }> {
    const { courseId } = await this.getActivityCourse(body.activityType, body.activityId);
    await this.assertManage(user, courseId);

    const indicator = await this.prisma.competencyIndicator.findFirst({
      where: { id: body.indicatorId, component: { category: { courseId } } },
      select: { id: true },
    });
    if (!indicator) throw new NotFoundException('Chỉ báo năng lực không thuộc khoá học.');

    const fk = this.activityFk(body.activityType, body.activityId);
    const data = {
      rubricNoEvidence: body.rubric.noEvidence?.trim() || null,
      rubricBeginning: body.rubric.beginning?.trim() || null,
      rubricApproaching: body.rubric.approaching?.trim() || null,
      rubricProficient: body.rubric.proficient?.trim() || null,
      rubricAdvanced: body.rubric.advanced?.trim() || null,
    };

    const updated = await this.prisma.activityCompetency.updateMany({
      where: { indicatorId: body.indicatorId, ...fk },
      data,
    });
    if (updated.count === 0) {
      throw new NotFoundException(
        'Chỉ báo này chưa được gắn vào hoạt động — gán trước khi sửa rubric.'
      );
    }

    return { message: 'Đã cập nhật rubric.' };
  }

  async upsertAssessment(
    user: AuthUser,
    body: UpsertCompetencyAssessmentBody
  ): Promise<CompetencyAssessmentItem> {
    const { courseId } = await this.getActivityCourse(body.activityType, body.activityId);
    await this.assertGrade(user, courseId);

    const indicator = await this.prisma.competencyIndicator.findFirst({
      where: { id: body.indicatorId, component: { category: { courseId } } },
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
      select: {
        indicator: {
          select: { component: { select: { category: { select: { courseId: true } } } } },
        },
      },
    });
    if (!assessment) throw new NotFoundException('Đánh giá năng lực không tồn tại.');
    await this.assertGrade(user, assessment.indicator.component.category.courseId);

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
        where: { studentId, indicator: { component: { category: { courseId } } } },
        orderBy: { gradedAt: 'desc' },
        include: {
          indicator: {
            select: {
              id: true,
              name: true,
              code: true,
              component: { select: { category: { select: { name: true } } } },
            },
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
    // Lấy tất cả attempt của HS rồi mới pick best. Ưu tiên SUBMITTED/GRADED;
    // nếu chỉ có IN_PROGRESS thì FE fallback sang trang danh sách bài làm.
    const [quizAttempts, practiceAttempts] = await Promise.all([
      quizIds.length > 0
        ? this.prisma.quizAttempt.findMany({
            where: { studentId, quizId: { in: quizIds } },
            select: { id: true, quizId: true, score: true, submittedAt: true, status: true },
          })
        : Promise.resolve(
            [] as {
              id: string;
              quizId: string;
              score: number | null;
              submittedAt: Date | null;
              status: string;
            }[]
          ),
      practiceIds.length > 0
        ? this.prisma.practiceTestAttempt.findMany({
            where: { studentId, practiceTestId: { in: practiceIds } },
            select: {
              id: true,
              practiceTestId: true,
              score: true,
              submittedAt: true,
              status: true,
            },
          })
        : Promise.resolve(
            [] as {
              id: string;
              practiceTestId: string;
              score: number | null;
              submittedAt: Date | null;
              status: string;
            }[]
          ),
    ]);

    function pickBest<
      T extends {
        id: string;
        score: number | null;
        submittedAt: Date | null;
        status: string;
      },
    >(attempts: T[]): string | undefined {
      if (attempts.length === 0) return undefined;
      // Ưu tiên attempt đã nộp (SUBMITTED/GRADED). Chỉ trả id khi attempt đó
      // hiển thị được — trang attempt staff sẽ redirect IN_PROGRESS sang list.
      const finished = attempts.filter((a) => a.status !== 'IN_PROGRESS');
      if (finished.length === 0) return undefined;
      const sorted = [...finished].sort((a, b) => {
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
        // Fallback sang trang danh sách bài làm để GV vẫn vào được bài của HS.
        viewerPath = attemptId
          ? `/quizzes/${activityId}/attempt/${attemptId}`
          : `/quizzes/${activityId}/attempts`;
      } else if (activityType === 'code-exercise') {
        // /exercises hoặc /scratch tuỳ language. Teacher panel ở trang chính hiển
        // thị danh sách bài nộp của tất cả HS — đủ để xem bài của HS này.
        const lang = r.codeExercise?.language;
        viewerPath = lang === 'SCRATCH' ? `/scratch/${activityId}` : `/exercises/${activityId}`;
      } else if (activityType === 'practice-test') {
        const attemptId = bestPracticeAttemptId.get(activityId);
        viewerPath = attemptId
          ? `/practice-tests/${activityId}/attempt/${attemptId}`
          : `/practice-tests/${activityId}/attempts`;
      }

      return {
        assessmentId: r.id,
        activityType,
        activityId,
        activityTitle,
        categoryName: r.indicator.component.category.name,
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

  // ── Xuất Excel "Tổng hợp kết quả" (giống cấu trúc file mẫu H.A.S) ─────
  // Phạm vi 1 lần xuất = 1 kỳ đánh giá × 1 danh mục, ở grain chi tiết hơn
  // getPeriodGrid: liệt kê từng minh chứng riêng lẻ (kèm rubric của đúng
  // hoạt động đã chấm), để FE dựng lại đúng bố cục sheet học sinh trong file
  // mẫu. Tái dùng cùng công thức điểm với getPeriodGrid.

  async getCategoryExportData(
    user: AuthUser,
    courseId: string,
    periodId: string,
    categoryId: string
  ): Promise<CompetencyExportData> {
    await this.assertGrade(user, courseId);

    const period = await this.prisma.competencyAssessmentPeriod.findFirst({
      where: { id: periodId, courseId },
    });
    if (!period) throw new NotFoundException('Kỳ đánh giá không tồn tại.');

    const category = await this.prisma.competencyCategory.findFirst({
      where: { id: categoryId, courseId },
      include: {
        components: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          include: { indicators: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } },
        },
      },
    });
    if (!category) throw new NotFoundException('Danh mục năng lực không tồn tại.');

    const indicatorIds = category.components.flatMap((c) => c.indicators.map((i) => i.id));

    const [enrollments, levelTargets, assessments, activityLinks] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { courseId, status: 'ACTIVE', user: { role: 'STUDENT' } },
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              firstName: true,
              lastName: true,
              email: true,
              username: true,
            },
          },
        },
        orderBy: [{ user: { fullName: 'asc' } }, { user: { email: 'asc' } }],
      }),
      this.prisma.competencyLevelTarget.findMany({ where: { periodId, categoryId } }),
      indicatorIds.length > 0
        ? this.prisma.competencyAssessment.findMany({
            where: {
              indicatorId: { in: indicatorIds },
              ...(period.startDate && period.endDate
                ? { gradedAt: { gte: period.startDate, lte: period.endDate } }
                : {}),
            },
            orderBy: { gradedAt: 'asc' },
            include: {
              assignment: { select: { title: true } },
              quiz: { select: { title: true } },
              codeExercise: { select: { title: true } },
              practiceTest: { select: { title: true } },
            },
          })
        : Promise.resolve([]),
      indicatorIds.length > 0
        ? this.prisma.activityCompetency.findMany({ where: { indicatorId: { in: indicatorIds } } })
        : Promise.resolve([]),
    ]);

    // indicatorId -> componentId, để gộp minh chứng đúng thành phần.
    const indicatorComponent = new Map<string, string>();
    for (const comp of category.components) {
      for (const ind of comp.indicators) indicatorComponent.set(ind.id, comp.id);
    }

    // `${indicatorId}::${activityKey}` -> rubric của đúng hoạt động đó.
    const rubricByKey = new Map<
      string,
      {
        noEvidence: string | null;
        beginning: string | null;
        approaching: string | null;
        proficient: string | null;
        advanced: string | null;
      }
    >();
    for (const link of activityLinks) {
      const activityKey = link.assignmentId
        ? `assignment:${link.assignmentId}`
        : link.quizId
          ? `quiz:${link.quizId}`
          : link.codeExerciseId
            ? `code-exercise:${link.codeExerciseId}`
            : `practice-test:${link.practiceTestId}`;
      rubricByKey.set(`${link.indicatorId}::${activityKey}`, {
        noEvidence: link.rubricNoEvidence,
        beginning: link.rubricBeginning,
        approaching: link.rubricApproaching,
        proficient: link.rubricProficient,
        advanced: link.rubricAdvanced,
      });
    }

    // studentId -> componentId -> indicatorId -> minh chứng[]
    type EvidenceRaw = {
      level: CompetencyLevelValue;
      activityTitle: string;
      activityKey: string;
      gradedAt: Date;
    };
    const evidenceTally = new Map<string, Map<string, Map<string, EvidenceRaw[]>>>();
    for (const a of assessments) {
      const componentId = indicatorComponent.get(a.indicatorId);
      if (!componentId) continue;
      const { activityType, activityTitle } = this.resolveActivity(a);
      const activityKey =
        activityType === 'assignment'
          ? `assignment:${a.assignmentId}`
          : activityType === 'quiz'
            ? `quiz:${a.quizId}`
            : activityType === 'code-exercise'
              ? `code-exercise:${a.codeExerciseId}`
              : `practice-test:${a.practiceTestId}`;

      let byComponent = evidenceTally.get(a.studentId);
      if (!byComponent) {
        byComponent = new Map();
        evidenceTally.set(a.studentId, byComponent);
      }
      let byIndicator = byComponent.get(componentId);
      if (!byIndicator) {
        byIndicator = new Map();
        byComponent.set(componentId, byIndicator);
      }
      const list = byIndicator.get(a.indicatorId) ?? [];
      list.push({
        level: a.level as CompetencyLevelValue,
        activityTitle,
        activityKey,
        gradedAt: a.gradedAt,
      });
      byIndicator.set(a.indicatorId, list);
    }

    const levelTargetByComponent = new Map<string, { startLevel: number; targetLevel: number }>();
    for (const lt of levelTargets) {
      levelTargetByComponent.set(`${lt.componentId}::${lt.studentId}`, {
        startLevel: lt.startLevel,
        targetLevel: lt.targetLevel,
      });
    }

    const students = enrollments.map(({ user: student }) => {
      const components = category.components.map((comp) => {
        const byIndicator = evidenceTally.get(student.id)?.get(comp.id);
        const target = levelTargetByComponent.get(`${comp.id}::${student.id}`);

        const indicators = comp.indicators.map((ind) => {
          const raw = byIndicator?.get(ind.id) ?? [];
          const levels = raw.map((r) => r.level);
          return {
            indicatorId: ind.id,
            code: ind.code,
            name: ind.name,
            completed: this.isIndicatorCompleted(levels),
            evidences: raw
              .sort((a, b) => a.gradedAt.getTime() - b.gradedAt.getTime())
              .map((r) => {
                const rubric = rubricByKey.get(`${ind.id}::${r.activityKey}`) ?? {
                  noEvidence: null,
                  beginning: null,
                  approaching: null,
                  proficient: null,
                  advanced: null,
                };
                return {
                  activityTitle: r.activityTitle,
                  level: r.level,
                  gradedAt: r.gradedAt.toISOString(),
                  rubric,
                };
              }),
          };
        });

        const totalCount = indicators.length;
        const completedCount = indicators.filter((i) => i.completed).length;
        const rate = totalCount > 0 ? completedCount / totalCount : null;
        const score = target && rate !== null ? target.startLevel + 2 * rate : null;
        const growth = score !== null && target ? score - target.startLevel : null;

        return {
          componentId: comp.id,
          code: comp.code,
          name: comp.name,
          startLevel: target?.startLevel ?? null,
          targetLevel: target?.targetLevel ?? null,
          indicators,
          completedCount,
          totalCount,
          rate,
          score,
          growth,
        };
      });

      const totalCount = components.reduce((sum, c) => sum + c.totalCount, 0);
      const completedCount = components.reduce((sum, c) => sum + c.completedCount, 0);
      const categoryRate = totalCount > 0 ? completedCount / totalCount : null;
      const allTargetsSet = components.length > 0 && components.every((c) => c.startLevel !== null);
      const categoryStart = allTargetsSet
        ? components.reduce((sum, c) => sum + c.startLevel!, 0) / components.length
        : null;
      const categoryTarget = allTargetsSet
        ? components.reduce((sum, c) => sum + c.targetLevel!, 0) / components.length
        : null;
      const scored = components.filter((c) => c.score !== null);
      const categoryScore =
        allTargetsSet && scored.length > 0
          ? scored.reduce((sum, c) => sum + c.score!, 0) / scored.length
          : null;
      const categoryGrowth =
        categoryScore !== null && categoryStart !== null ? categoryScore - categoryStart : null;

      return {
        studentId: student.id,
        studentCode: student.username ?? student.email,
        fullName: this.displayName(student),
        components,
        categoryStart,
        categoryTarget,
        categoryRate,
        categoryScore,
        categoryGrowth,
        learningPace: categoryRate !== null ? learningPaceFromRate(categoryRate) : null,
      };
    });

    return {
      category: { id: category.id, name: category.name },
      period: { id: period.id, name: period.name },
      students,
    };
  }

  // ── Quy tắc hoàn thành chỉ báo (Chính sách đánh giá H.A.S) ────

  private isIndicatorCompleted(levels: CompetencyLevelValue[]): boolean {
    const masteredCount = levels.filter((l) => MASTERED_LEVELS.includes(l)).length;
    return masteredCount >= INDICATOR_COMPLETION_MIN_EVIDENCE;
  }

  // ── Thống kê toàn khoá ───────────────────────────────────────

  async getStats(user: AuthUser, courseId: string): Promise<CompetencyStats> {
    await this.assertGrade(user, courseId);

    const [categories, assessments, enrollments] = await Promise.all([
      this.prisma.competencyCategory.findMany({
        where: { courseId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include: {
          components: {
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            include: { indicators: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } },
          },
        },
      }),
      this.prisma.competencyAssessment.findMany({
        where: { indicator: { component: { category: { courseId } } } },
        include: {
          indicator: {
            select: { id: true, name: true, code: true, componentId: true },
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
      for (const comp of c.components) {
        for (const ind of comp.indicators) {
          totalIndicators++;
          indicatorMeta.set(ind.id, {
            name: ind.name,
            code: ind.code,
            categoryId: c.id,
            categoryName: c.name,
          });
        }
      }
    }

    // Khởi tạo accumulator cho từng chỉ báo / học sinh / danh mục.
    const indAcc = new Map<
      string,
      { counts: Record<CompetencyLevelValue, number>; scoreSum: number; total: number }
    >();
    const studentAcc = new Map<
      string,
      {
        name: string;
        email: string;
        counts: Record<CompetencyLevelValue, number>;
        scoreSum: number;
        total: number;
      }
    >();
    const catAcc = new Map<string, { scoreSum: number; total: number }>();
    const evidenceAcc = new Map<string, number>();
    // (indicatorId -> studentId -> mức độ đã ghi nhận) — dùng để tính "hoàn thành chỉ báo"
    // theo Chính sách đánh giá H.A.S: ≥2 minh chứng đạt Thành thạo/Vượt thành thạo.
    const indicatorStudentLevels = new Map<string, Map<string, CompetencyLevelValue[]>>();

    for (const { user: u } of enrollments) {
      studentAcc.set(u.id, {
        name: this.displayName(u),
        email: u.email,
        counts: EMPTY_LEVEL_COUNTS(),
        scoreSum: 0,
        total: 0,
      });
    }

    for (const a of assessments) {
      const level = a.level as CompetencyLevelValue;
      const score = COMPETENCY_LEVEL_SCORE[level] ?? 0;

      // indicator
      let ia = indAcc.get(a.indicatorId);
      if (!ia) {
        ia = { counts: EMPTY_LEVEL_COUNTS(), scoreSum: 0, total: 0 };
        indAcc.set(a.indicatorId, ia);
      }
      ia.counts[level]++;
      ia.scoreSum += score;
      ia.total++;

      // student
      let sa = studentAcc.get(a.studentId);
      if (!sa) {
        sa = {
          name: this.displayName(a.student),
          email: a.student.email,
          counts: EMPTY_LEVEL_COUNTS(),
          scoreSum: 0,
          total: 0,
        };
        studentAcc.set(a.studentId, sa);
      }
      sa.counts[level]++;
      sa.scoreSum += score;
      sa.total++;

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

      // hoàn thành chỉ báo
      let byStudent = indicatorStudentLevels.get(a.indicatorId);
      if (!byStudent) {
        byStudent = new Map();
        indicatorStudentLevels.set(a.indicatorId, byStudent);
      }
      const levels = byStudent.get(a.studentId);
      if (levels) levels.push(level);
      else byStudent.set(a.studentId, [level]);
    }

    // studentId -> { assessed: số chỉ báo có minh chứng, completed: số chỉ báo "hoàn thành" }
    const studentIndicatorTally = new Map<string, { assessed: number; completed: number }>();
    const indicatorCompletion = new Map<
      string,
      { studentsAssessedCount: number; studentsCompletedCount: number }
    >();
    for (const [indicatorId, byStudent] of indicatorStudentLevels) {
      let completedCount = 0;
      for (const [studentId, levels] of byStudent) {
        const completed = this.isIndicatorCompleted(levels);
        if (completed) completedCount++;

        let t = studentIndicatorTally.get(studentId);
        if (!t) {
          t = { assessed: 0, completed: 0 };
          studentIndicatorTally.set(studentId, t);
        }
        t.assessed++;
        if (completed) t.completed++;
      }
      indicatorCompletion.set(indicatorId, {
        studentsAssessedCount: byStudent.size,
        studentsCompletedCount: completedCount,
      });
    }

    const indicators = [...indicatorMeta.entries()].map(([indicatorId, meta]) => {
      const acc = indAcc.get(indicatorId);
      const completion = indicatorCompletion.get(indicatorId);
      return {
        indicatorId,
        indicatorName: meta.name,
        indicatorCode: meta.code,
        categoryId: meta.categoryId,
        categoryName: meta.categoryName,
        totalAssessments: acc?.total ?? 0,
        studentsAssessedCount: completion?.studentsAssessedCount ?? 0,
        studentsCompletedCount: completion?.studentsCompletedCount ?? 0,
        averageScore: acc && acc.total > 0 ? acc.scoreSum / acc.total : null,
        levelCounts: acc?.counts ?? EMPTY_LEVEL_COUNTS(),
      };
    });

    const students = [...studentAcc.entries()].map(([studentId, acc]) => {
      const tally = studentIndicatorTally.get(studentId);
      return {
        studentId,
        studentName: acc.name,
        email: acc.email,
        totalAssessments: acc.total,
        indicatorsAssessedCount: tally?.assessed ?? 0,
        indicatorsCompletedCount: tally?.completed ?? 0,
        averageScore: acc.total > 0 ? acc.scoreSum / acc.total : null,
        levelCounts: acc.counts,
      };
    });

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

  private toPeriodItem = (p: {
    id: string;
    courseId: string;
    name: string;
    position: number;
    startDate: Date | null;
    endDate: Date | null;
  }): CompetencyPeriod => ({
    id: p.id,
    courseId: p.courseId,
    name: p.name,
    position: p.position,
    startDate: p.startDate ? p.startDate.toISOString() : null,
    endDate: p.endDate ? p.endDate.toISOString() : null,
  });

  private toIndicatorItem = (i: {
    id: string;
    componentId: string;
    code: string | null;
    name: string;
    description: string | null;
    position: number;
  }): CompetencyIndicatorItem => ({
    id: i.id,
    componentId: i.componentId,
    code: i.code,
    name: i.name,
    description: i.description,
    position: i.position,
  });

  private toComponentItem = (c: {
    id: string;
    categoryId: string;
    code: string | null;
    name: string;
    position: number;
    indicators: {
      id: string;
      componentId: string;
      code: string | null;
      name: string;
      description: string | null;
      position: number;
    }[];
  }): CompetencyComponentItem => ({
    id: c.id,
    categoryId: c.categoryId,
    code: c.code,
    name: c.name,
    position: c.position,
    indicators: c.indicators.map(this.toIndicatorItem),
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
