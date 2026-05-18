import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaClient } from '@lumibach/db';
import type {
  CoursesQuery,
  CourseListItem,
  CourseDetail,
  CreateCourseBody,
  UpdateCourseBody,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';
import { AuditService } from '../../common/audit/audit.service';

const ROLE_ORDER = ['STUDENT', 'TA', 'TEACHER', 'ADMIN', 'SUPERADMIN'] as const;
type Role = (typeof ROLE_ORDER)[number];

function hasMinRole(userRole: string, minRole: Role): boolean {
  return ROLE_ORDER.indexOf(userRole as Role) >= ROLE_ORDER.indexOf(minRole);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const OWNER_SELECT = {
  id: true,
  fullName: true,
  firstName: true,
  lastName: true,
  email: true,
  avatar: true,
} as const;

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaClient,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly audit: AuditService
  ) {}

  async createCourse(actor: AuthUser, body: CreateCourseBody): Promise<{ slug: string }> {
    if (!hasMinRole(actor.role, 'TEACHER')) throw new ForbiddenException('Không có quyền');

    const baseSlug = slugify(body.name);
    if (!baseSlug) throw new ForbiddenException('Tên khoá học không hợp lệ');

    let slug = baseSlug;
    let attempt = 0;
    while (await this.prisma.course.findUnique({ where: { slug } })) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    const course = await this.prisma.course.create({
      data: {
        name: body.name,
        shortName: body.shortName || null,
        slug,
        description: body.description || null,
        subject: body.subject || null,
        gradeLevel: body.gradeLevel || null,
        status: (body.status ?? 'DRAFT') as any,
        isPublic: body.isPublic ?? false,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        ownerId: actor.id,
        publishedAt: body.status === 'PUBLISHED' ? new Date() : null,
        thumbnail: body.thumbnail || null,
      },
    });

    this.audit.log({
      userId: actor.id,
      userRole: actor.role,
      action: 'COURSE_CREATE',
      resource: 'Course',
      resourceId: course.id,
      changes: { name: body.name, slug, status: body.status },
    });

    return { slug: course.slug };
  }

  async updateCourse(
    actor: AuthUser,
    courseId: string,
    body: UpdateCourseBody
  ): Promise<{ slug: string }> {
    if (!hasMinRole(actor.role, 'TEACHER')) throw new ForbiddenException('Không có quyền');

    const existing = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!existing) throw new NotFoundException('Khoá học không tồn tại');
    if (actor.role !== 'ADMIN' && existing.ownerId !== actor.id) {
      throw new ForbiddenException('Bạn không có quyền sửa khoá học này');
    }

    const publishedAt =
      body.status === 'PUBLISHED' && existing.status !== 'PUBLISHED'
        ? new Date()
        : existing.publishedAt;
    const archivedAt =
      body.status === 'ARCHIVED' && existing.status !== 'ARCHIVED'
        ? new Date()
        : existing.archivedAt;

    const course = await this.prisma.course.update({
      where: { id: courseId },
      data: {
        name: body.name,
        shortName: body.shortName || null,
        description: body.description || null,
        subject: body.subject || null,
        gradeLevel: body.gradeLevel || null,
        status: body.status as any,
        isPublic: body.isPublic,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        publishedAt,
        archivedAt,
        ...(body.thumbnail !== undefined ? { thumbnail: body.thumbnail || null } : {}),
      },
    });

    await this.cache.del(`courses:detail:slug:${course.slug}`);

    this.audit.log({
      userId: actor.id,
      userRole: actor.role,
      action: 'COURSE_UPDATE',
      resource: 'Course',
      resourceId: courseId,
      changes: { name: body.name, status: body.status },
    });

    return { slug: course.slug };
  }

  async deleteCourse(actor: AuthUser, courseId: string): Promise<void> {
    if (!hasMinRole(actor.role, 'TEACHER')) throw new ForbiddenException('Không có quyền');

    const existing = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!existing) throw new NotFoundException('Khoá học không tồn tại');
    if (actor.role !== 'ADMIN' && existing.ownerId !== actor.id) {
      throw new ForbiddenException('Bạn không có quyền xoá khoá học này');
    }

    await this.prisma.course.update({
      where: { id: courseId },
      data: { deletedAt: new Date() },
    });

    await this.cache.del(`courses:detail:slug:${existing.slug}`);

    this.audit.log({
      userId: actor.id,
      userRole: actor.role,
      action: 'COURSE_DELETE',
      resource: 'Course',
      resourceId: courseId,
    });
  }

  async listCourses(
    actor: AuthUser,
    params: CoursesQuery
  ): Promise<{
    courses: CourseListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const { q, status, page = 1, pageSize = 12, ownOnly } = params;

    const where: any = {
      deletedAt: null,
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      ...(status ? { status } : {}),
      ...(actor.role === 'STUDENT'
        ? {
            status: 'PUBLISHED',
            enrollments: {
              some: { userId: actor.id, status: { in: ['ACTIVE', 'COMPLETED'] } },
            },
          }
        : {}),
      ...(actor.role === 'TA'
        ? {
            teachingAssistants: { some: { userId: actor.id } },
          }
        : {}),
      ...(actor.role === 'TEACHER'
        ? {
            OR: [{ ownerId: actor.id }, { coTeachers: { some: { userId: actor.id } } }],
          }
        : {}),
      ...(ownOnly ? { ownerId: actor.id } : {}),
    };

    const [total, courses] = await Promise.all([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          shortName: true,
          slug: true,
          thumbnail: true,
          subject: true,
          gradeLevel: true,
          status: true,
          isPublic: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          owner: { select: OWNER_SELECT },
          _count: { select: { enrollments: true } },
        },
      }),
    ]);

    return {
      courses: courses.map((c) => ({
        ...c,
        startDate: c.startDate?.toISOString() ?? null,
        endDate: c.endDate?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        status: c.status as string,
      })) as CourseListItem[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getCourseBySlug(actor: AuthUser, slug: string): Promise<CourseDetail> {
    const cacheKey = `courses:detail:slug:${slug}`;
    const cached = await this.cached(cacheKey, 300_000, async () => {
      const c = await this.prisma.course.findFirst({
        where: { slug, deletedAt: null },
        include: { owner: { select: OWNER_SELECT } },
      });
      if (!c) throw new NotFoundException('Khoá học không tồn tại');

      return {
        id: c.id,
        name: c.name,
        shortName: c.shortName,
        slug: c.slug,
        thumbnail: c.thumbnail,
        subject: c.subject,
        gradeLevel: c.gradeLevel,
        status: c.status as string,
        isPublic: c.isPublic,
        description: c.description,
        enrollmentCode: c.enrollmentCode,
        ownerId: c.ownerId,
        startDate: c.startDate?.toISOString() ?? null,
        endDate: c.endDate?.toISOString() ?? null,
        publishedAt: c.publishedAt?.toISOString() ?? null,
        archivedAt: c.archivedAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        owner: c.owner,
      };
    });

    if (!(await this.canViewCourse(actor, cached.id))) {
      throw new NotFoundException('Khoá học không tồn tại');
    }

    // Counts change frequently (enrollments, TA assignments), so fetch fresh
    // each time rather than caching with the rest of the detail.
    const [enrollmentCount, taCount] = await Promise.all([
      this.prisma.enrollment.count({ where: { courseId: cached.id } }),
      this.prisma.teachingAssistant.count({ where: { courseId: cached.id } }),
    ]);

    return {
      ...cached,
      _count: { enrollments: enrollmentCount, teachingAssistants: taCount },
    } as CourseDetail;
  }

  private async canViewCourse(actor: AuthUser, courseId: string): Promise<boolean> {
    if (actor.role === 'ADMIN') return true;
    const found = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        deletedAt: null,
        OR: [
          { ownerId: actor.id },
          { coTeachers: { some: { userId: actor.id } } },
          { teachingAssistants: { some: { userId: actor.id } } },
          {
            enrollments: {
              some: { userId: actor.id, status: { in: ['ACTIVE', 'COMPLETED'] } },
            },
          },
        ],
      },
      select: { id: true },
    });
    return found !== null;
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
