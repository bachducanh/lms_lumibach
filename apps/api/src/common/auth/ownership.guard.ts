import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  mixin,
  type Type,
} from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import type { Request } from 'express';
import type { AuthUser } from './auth.types';

type Resource = 'course'; // sẽ mở rộng: 'assignment' | 'quiz' | ... ở Phase 3+

type OwnershipOpts = {
  /** Param name trong URL chứa ID resource (vd: 'courseId' từ /:courseId) */
  param: string;
  /** Cho phép TA được assign vào course pass kiểm tra? Default true. */
  allowTeachingAssistant?: boolean;
  /** Cho phép co-teacher? Default true. */
  allowCoTeacher?: boolean;
};

/**
 * Factory tạo guard kiểm tra ownership cho 1 resource cụ thể.
 *
 * Usage:
 *   @UseGuards(CourseOwnership({ param: 'courseId' }))
 *   @Patch(':courseId')
 *   update(...) { ... }
 *
 * Quy tắc (theo §10 PROJECT_CONTEXT — Course matrix):
 * - ADMIN: pass.
 * - Owner của course: pass.
 * - Co-teacher: pass (nếu allowCoTeacher).
 * - TA được assign: pass (nếu allowTeachingAssistant).
 * - Khác: 403.
 *
 * Áp dụng SAU NextAuthGuard (cần req.user). Đặt sau @UseGuards trên controller.
 */
function buildCourseOwnership(opts: OwnershipOpts): Type<CanActivate> {
  const { param, allowTeachingAssistant = true, allowCoTeacher = true } = opts;

  @Injectable()
  class MixinGuard implements CanActivate {
    private readonly logger = new Logger(`CourseOwnership(${param})`);

    constructor(public readonly prisma: PrismaClient) {}

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
      const req = ctx.switchToHttp().getRequest<Request>();
      const user = req.user as AuthUser | undefined;
      if (!user) throw new ForbiddenException('No authenticated user');
      if (user.role === 'ADMIN') return true;

      const params = req.params as Record<string, string>;
      const id = params[param];
      if (!id) {
        throw new ForbiddenException(`Missing route param '${param}'`);
      }

      const course = await this.prisma.course.findUnique({
        where: { id, deletedAt: null },
        select: { id: true, ownerId: true },
      });
      if (!course) throw new ForbiddenException('Course not found');

      if (course.ownerId === user.id) return true;

      if (allowCoTeacher) {
        const coTeacher = await this.prisma.courseCoTeacher.findUnique({
          where: { userId_courseId: { userId: user.id, courseId: course.id } },
          select: { id: true },
        });
        if (coTeacher) return true;
      }

      if (allowTeachingAssistant) {
        const ta = await this.prisma.teachingAssistant.findUnique({
          where: { userId_courseId: { userId: user.id, courseId: course.id } },
          select: { id: true },
        });
        if (ta) return true;
      }

      this.logger.debug(`User ${user.id} not authorized for course ${course.id}`);
      throw new ForbiddenException('Not authorized for this course');
    }
  }

  return mixin(MixinGuard);
}

export const CourseOwnership = (opts: OwnershipOpts) => buildCourseOwnership(opts);

// Export type cho consumers tự build guard mới ở Phase 3+
export type { OwnershipOpts, Resource };
