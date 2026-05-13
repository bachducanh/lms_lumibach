import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import type {
  CreateLessonBody,
  LessonDetail,
  MarkCompleteBody,
  UpdateLessonBody,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';

const ROLE_ORDER = ['STUDENT', 'TA', 'TEACHER', 'ADMIN', 'SUPERADMIN'] as const;
type Role = (typeof ROLE_ORDER)[number];

function hasMinRole(userRole: string, minRole: Role): boolean {
  return ROLE_ORDER.indexOf(userRole as Role) >= ROLE_ORDER.indexOf(minRole);
}

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaClient) {}

  async createLesson(
    actor: AuthUser,
    body: CreateLessonBody
  ): Promise<{ lessonId: string; itemId: string }> {
    if (!hasMinRole(actor.role, 'TEACHER')) throw new ForbiddenException('Không có quyền');

    const mod = await this.prisma.module.findUnique({ where: { id: body.moduleId } });
    if (!mod || mod.courseId !== body.courseId) throw new NotFoundException('Chương không hợp lệ');

    const lesson = await this.prisma.lesson.create({
      data: {
        title: body.title,
        content: body.content ?? '',
        estimatedMinutes: body.estimatedMinutes ?? null,
        createdBy: actor.id,
      },
    });

    const last = await this.prisma.moduleItem.findFirst({
      where: { moduleId: body.moduleId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (last?.position ?? -1) + 1;

    const item = await this.prisma.moduleItem.create({
      data: {
        moduleId: body.moduleId,
        type: 'LESSON',
        position,
        title: body.title,
        lessonId: lesson.id,
      },
    });

    return { lessonId: lesson.id, itemId: item.id };
  }

  async updateLesson(actor: AuthUser, lessonId: string, body: UpdateLessonBody): Promise<void> {
    if (!hasMinRole(actor.role, 'TEACHER')) throw new ForbiddenException('Không có quyền');

    const existing = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!existing) throw new NotFoundException('Bài giảng không tồn tại');

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.content !== undefined) data.content = body.content;
    if (body.estimatedMinutes !== undefined) data.estimatedMinutes = body.estimatedMinutes;

    await this.prisma.$transaction([
      this.prisma.lesson.update({ where: { id: lessonId }, data }),
      ...(body.title
        ? [this.prisma.moduleItem.updateMany({ where: { lessonId }, data: { title: body.title } })]
        : []),
    ]);
  }

  async getLesson(_actor: AuthUser, lessonId: string): Promise<LessonDetail> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        moduleItems: {
          include: { module: { select: { id: true, name: true, courseId: true } } },
        },
        attachments: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, url: true, mimeType: true, size: true, createdAt: true },
        },
      },
    });
    if (!lesson) throw new NotFoundException('Bài giảng không tồn tại');

    return {
      id: lesson.id,
      title: lesson.title,
      content: lesson.content,
      estimatedMinutes: lesson.estimatedMinutes,
      createdBy: lesson.createdBy,
      createdAt: lesson.createdAt.toISOString(),
      updatedAt: lesson.updatedAt.toISOString(),
      moduleItems: lesson.moduleItems.map((mi) => ({
        id: mi.id,
        isPublished: mi.isPublished,
        module: mi.module,
      })),
      attachments: lesson.attachments.map((a) => ({
        id: a.id,
        name: a.name,
        url: a.url,
        mimeType: a.mimeType,
        size: a.size,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  async markComplete(actor: AuthUser, body: MarkCompleteBody): Promise<void> {
    const item = await this.prisma.moduleItem.findUnique({
      where: { id: body.moduleItemId },
      include: { module: { select: { courseId: true } } },
    });
    if (!item) throw new NotFoundException('Bài học không tồn tại');

    const courseId = item.module.courseId;

    await this.prisma.moduleItemCompletion.upsert({
      where: { userId_moduleItemId: { userId: actor.id, moduleItemId: body.moduleItemId } },
      create: { userId: actor.id, moduleItemId: body.moduleItemId },
      update: { completedAt: new Date() },
    });

    await this.recalcProgress(actor.id, courseId);
  }

  async unmarkComplete(actor: AuthUser, moduleItemId: string): Promise<void> {
    const item = await this.prisma.moduleItem.findUnique({
      where: { id: moduleItemId },
      include: { module: { select: { courseId: true } } },
    });
    if (!item) throw new NotFoundException('Bài học không tồn tại');

    const courseId = item.module.courseId;
    await this.prisma.moduleItemCompletion.deleteMany({
      where: { userId: actor.id, moduleItemId },
    });

    await this.recalcProgress(actor.id, courseId);
  }

  private async recalcProgress(userId: string, courseId: string): Promise<void> {
    const [totalItems, completedItems] = await Promise.all([
      this.prisma.moduleItem.count({ where: { module: { courseId }, isPublished: true } }),
      this.prisma.moduleItemCompletion.count({
        where: { userId, moduleItem: { module: { courseId }, isPublished: true } },
      }),
    ]);
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    await this.prisma.enrollment.updateMany({
      where: { userId, courseId },
      data: { progress, lastAccessAt: new Date() },
    });
  }
}
