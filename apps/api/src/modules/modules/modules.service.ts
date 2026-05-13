import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaClient } from '@lumibach/db';
import type {
  AddModuleItemBody,
  CreateModuleBody,
  CourseNavItem,
  ModuleWithItems,
  ReorderItemsBody,
  ReorderModulesBody,
  UpdateModuleBody,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';

const ROLE_ORDER = ['STUDENT', 'TA', 'TEACHER', 'ADMIN', 'SUPERADMIN'] as const;
type Role = (typeof ROLE_ORDER)[number];

function hasMinRole(userRole: string, minRole: Role): boolean {
  return ROLE_ORDER.indexOf(userRole as Role) >= ROLE_ORDER.indexOf(minRole);
}

@Injectable()
export class ModulesService {
  constructor(
    private readonly prisma: PrismaClient,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ) {}

  private async assertCanManage(courseId: string, actor: AuthUser): Promise<void> {
    if (!hasMinRole(actor.role, 'TEACHER')) throw new ForbiddenException('Không có quyền');
    if (actor.role === 'ADMIN' || actor.role === 'SUPERADMIN') return;
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Khoá học không tồn tại');
    if (course.ownerId !== actor.id)
      throw new ForbiddenException('Bạn không có quyền quản lý khoá học này');
  }

  private invalidate(courseId: string) {
    this.cache.del(`modules:${courseId}`).catch(() => {});
    this.cache.del(`modules:nav:${courseId}`).catch(() => {});
  }

  async createModule(actor: AuthUser, body: CreateModuleBody): Promise<{ id: string }> {
    await this.assertCanManage(body.courseId, actor);

    const last = await this.prisma.module.findFirst({
      where: { courseId: body.courseId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (last?.position ?? -1) + 1;

    const mod = await this.prisma.module.create({
      data: {
        courseId: body.courseId,
        name: body.name,
        description: body.description ?? null,
        position,
      },
    });

    this.invalidate(body.courseId);
    return { id: mod.id };
  }

  async updateModule(actor: AuthUser, moduleId: string, body: UpdateModuleBody): Promise<void> {
    const mod = await this.prisma.module.findUnique({ where: { id: moduleId } });
    if (!mod) throw new NotFoundException('Chương không tồn tại');
    await this.assertCanManage(mod.courseId, actor);

    await this.prisma.module.update({
      where: { id: moduleId },
      data: { name: body.name, description: body.description ?? null },
    });
    this.invalidate(mod.courseId);
  }

  async deleteModule(actor: AuthUser, moduleId: string): Promise<void> {
    const mod = await this.prisma.module.findUnique({ where: { id: moduleId } });
    if (!mod) throw new NotFoundException('Chương không tồn tại');
    await this.assertCanManage(mod.courseId, actor);

    await this.prisma.module.delete({ where: { id: moduleId } });
    this.invalidate(mod.courseId);
  }

  async toggleModulePublish(actor: AuthUser, moduleId: string): Promise<void> {
    const mod = await this.prisma.module.findUnique({ where: { id: moduleId } });
    if (!mod) throw new NotFoundException('Chương không tồn tại');
    await this.assertCanManage(mod.courseId, actor);

    await this.prisma.module.update({
      where: { id: moduleId },
      data: { isPublished: !mod.isPublished },
    });
    this.invalidate(mod.courseId);
  }

  async reorderModules(actor: AuthUser, body: ReorderModulesBody): Promise<void> {
    await this.assertCanManage(body.courseId, actor);
    await Promise.all(
      body.orderedIds.map((id, index) =>
        this.prisma.module.update({ where: { id }, data: { position: index } })
      )
    );
    this.invalidate(body.courseId);
  }

  async reorderModuleItems(
    actor: AuthUser,
    moduleId: string,
    body: ReorderItemsBody
  ): Promise<void> {
    const mod = await this.prisma.module.findUnique({ where: { id: moduleId } });
    if (!mod) throw new NotFoundException('Chương không tồn tại');
    await this.assertCanManage(mod.courseId, actor);

    await Promise.all(
      body.orderedIds.map((id, index) =>
        this.prisma.moduleItem.update({ where: { id }, data: { position: index } })
      )
    );
    this.invalidate(mod.courseId);
  }

  async addModuleItem(
    actor: AuthUser,
    moduleId: string,
    body: AddModuleItemBody
  ): Promise<{ id: string }> {
    const mod = await this.prisma.module.findUnique({ where: { id: moduleId } });
    if (!mod) throw new NotFoundException('Chương không tồn tại');
    await this.assertCanManage(mod.courseId, actor);

    const last = await this.prisma.moduleItem.findFirst({
      where: { moduleId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (last?.position ?? -1) + 1;

    const item = await this.prisma.moduleItem.create({
      data: {
        moduleId,
        type: body.type as any,
        position,
        title: body.title,
        lessonId: body.lessonId ?? null,
        externalUrl: body.externalUrl ?? null,
      },
    });

    this.invalidate(mod.courseId);
    return { id: item.id };
  }

  async toggleModuleItemPublish(actor: AuthUser, itemId: string): Promise<void> {
    const item = await this.prisma.moduleItem.findUnique({
      where: { id: itemId },
      include: { module: true },
    });
    if (!item) throw new NotFoundException('Không tìm thấy');
    await this.assertCanManage(item.module.courseId, actor);

    await this.prisma.moduleItem.update({
      where: { id: itemId },
      data: { isPublished: !item.isPublished },
    });
    this.invalidate(item.module.courseId);
  }

  async deleteModuleItem(actor: AuthUser, itemId: string): Promise<void> {
    const item = await this.prisma.moduleItem.findUnique({
      where: { id: itemId },
      include: { module: true },
    });
    if (!item) throw new NotFoundException('Không tìm thấy');
    await this.assertCanManage(item.module.courseId, actor);

    await this.prisma.moduleItem.delete({ where: { id: itemId } });
    this.invalidate(item.module.courseId);
  }

  async listModules(courseId: string, publishedOnly: boolean): Promise<ModuleWithItems[]> {
    const cacheKey = publishedOnly ? `modules:pub:${courseId}` : `modules:${courseId}`;
    return this.cached(cacheKey, 120_000, async () => {
      const modules = await this.prisma.module.findMany({
        where: { courseId, ...(publishedOnly ? { isPublished: true } : {}) },
        orderBy: { position: 'asc' },
        include: {
          items: {
            where: publishedOnly ? { isPublished: true } : undefined,
            orderBy: { position: 'asc' },
            include: {
              lesson: { select: { id: true, title: true, estimatedMinutes: true } },
              quiz: { select: { id: true, title: true, status: true } } as any,
              codeExercise: { select: { id: true, title: true, language: true, status: true } },
            },
          },
        },
      });
      return modules.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        items: m.items.map((it) => ({
          ...it,
          quiz: it.quiz as any,
        })),
      })) as ModuleWithItems[];
    });
  }

  async listCourseNavItems(courseId: string, publishedOnly: boolean): Promise<CourseNavItem[]> {
    const cacheKey = publishedOnly ? `modules:nav:pub:${courseId}` : `modules:nav:${courseId}`;
    return this.cached(cacheKey, 120_000, async () => {
      const items = await this.prisma.moduleItem.findMany({
        where: {
          module: { courseId, ...(publishedOnly ? { isPublished: true } : {}) },
          type: { in: ['LESSON', 'ASSIGNMENT', 'QUIZ', 'CODE_EXERCISE'] },
          ...(publishedOnly ? { isPublished: true } : {}),
          ...(publishedOnly
            ? {
                OR: [
                  { type: { not: 'CODE_EXERCISE' } },
                  { type: 'CODE_EXERCISE', codeExercise: { status: 'PUBLISHED' } },
                ],
              }
            : {}),
        },
        orderBy: [{ module: { position: 'asc' } }, { position: 'asc' }],
        select: {
          id: true,
          title: true,
          type: true,
          lessonId: true,
          assignmentId: true,
          quizId: true,
          codeExerciseId: true,
          codeExercise: { select: { language: true } },
        },
      });
      return items as CourseNavItem[];
    });
  }

  private async cached<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    if (process.env.NODE_ENV === 'test') return factory();
    const hit = await this.cache.get<T>(key);
    if (hit !== undefined && hit !== null) return hit;
    const fresh = await factory();
    await this.cache.set(key, fresh, ttlMs);
    return fresh;
  }
}
