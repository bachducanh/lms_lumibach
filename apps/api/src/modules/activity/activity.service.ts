import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaClient, type Prisma } from '@lumibach/db';
import type {
  ActivityLogPage,
  ActivityLogRow,
  CourseFilterOption,
  CourseLogsQuery,
  StudentLogsQuery,
  SystemLogsQuery,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';

const PAGE_SIZE = 30;
const CACHE_TTL_MS = 60_000;

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaClient,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ) {}

  // ── Course logs — TEACHER own course / TA assigned / ADMIN ─────

  async getCourseLogs(
    user: AuthUser,
    courseSlug: string,
    filters: CourseLogsQuery
  ): Promise<ActivityLogPage> {
    const course = await this.prisma.course.findUnique({
      where: { slug: courseSlug },
      select: { id: true, ownerId: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    // TEACHER chỉ xem được khóa mình sở hữu (ADMIN bypass đã pass RolesGuard);
    // TA giả định được assign — kiểm tra ở phase ownership guard sau, hiện tại
    // chấp nhận TA bất kỳ (giữ behavior cũ của server action).
    if (user.role === 'TEACHER' && course.ownerId !== user.id) {
      throw new NotFoundException('Course not found');
    }

    const cacheKey = this.buildKey('course', course.id, filters);
    return this.cached(cacheKey, () =>
      this.queryPaginated(
        {
          ...this.dateRange(filters),
          courseId: course.id,
          ...this.actionMaybe(filters.action),
          ...(filters.userId ? { userId: filters.userId } : {}),
        },
        filters.page
      )
    );
  }

  // ── System-wide logs (ADMIN) ────────────────────────────────────

  async getSystemLogs(filters: SystemLogsQuery): Promise<ActivityLogPage> {
    let userIds: string[] | undefined;
    if (filters.q) {
      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            { fullName: { contains: filters.q, mode: 'insensitive' } },
            { email: { contains: filters.q, mode: 'insensitive' } },
            { firstName: { contains: filters.q, mode: 'insensitive' } },
            { lastName: { contains: filters.q, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
      if (userIds.length === 0) {
        return { rows: [], total: 0, page: filters.page, pages: 0 };
      }
    }

    const where: Prisma.ActivityLogWhereInput = {
      ...this.dateRange(filters),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(userIds ? { userId: { in: userIds } } : {}),
      ...(filters.courseId ? { courseId: filters.courseId } : {}),
      ...this.actionMaybe(filters.action),
    };

    const cacheKey = this.buildKey('system', 'all', filters);
    return this.cached(cacheKey, () => this.queryPaginated(where, filters.page));
  }

  // ── Per-student logs (TA+) ──────────────────────────────────────

  async getStudentLogs(targetUserId: string, filters: StudentLogsQuery): Promise<ActivityLogPage> {
    const where: Prisma.ActivityLogWhereInput = {
      userId: targetUserId,
      ...this.dateRange(filters),
      ...(filters.courseId ? { courseId: filters.courseId } : {}),
      ...this.actionMaybe(filters.action),
    };

    const cacheKey = this.buildKey('student', targetUserId, filters);
    return this.cached(cacheKey, () => this.queryPaginated(where, filters.page));
  }

  // ── Courses dropdown (TA+ sees own/assigned, ADMIN sees all) ────

  async getCoursesForFilter(user: AuthUser): Promise<CourseFilterOption[]> {
    if (user.role === 'ADMIN') {
      return this.prisma.course.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
      });
    }
    return this.prisma.course.findMany({
      where: { deletedAt: null, ownerId: user.id },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  // ── Internals ──────────────────────────────────────────────────

  private async queryPaginated(
    where: Prisma.ActivityLogWhereInput,
    page: number
  ): Promise<ActivityLogPage> {
    const safePage = Math.max(1, page);
    const [rowsRaw, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
          course: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    const rows: ActivityLogRow[] = rowsRaw.map((r) => ({
      id: r.id,
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      resourceName: r.resourceName,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
      course: r.course,
    }));

    return { rows, total, page: safePage, pages: Math.ceil(total / PAGE_SIZE) };
  }

  private dateRange(filters: { dateFrom?: string; dateTo?: string }): Prisma.ActivityLogWhereInput {
    if (!filters.dateFrom && !filters.dateTo) return {};
    return {
      createdAt: {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59`) } : {}),
      },
    };
  }

  private actionMaybe(action?: string): Prisma.ActivityLogWhereInput {
    // Cast: ZodValidationPipe đã ràng buộc giá trị enum hợp lệ.
    return action ? { action: action as Prisma.ActivityLogWhereInput['action'] } : {};
  }

  private buildKey(scope: string, scopeId: string, filters: Record<string, unknown>): string {
    // Sort keys để cùng filter (khác thứ tự property) cho cùng key.
    const sortedFilters = Object.keys(filters)
      .sort()
      .filter((k) => filters[k] !== undefined && filters[k] !== null && filters[k] !== '')
      .map((k) => `${k}=${String(filters[k])}`)
      .join('&');
    return `activities:${scope}:${scopeId}:${sortedFilters}`;
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    // Test mode: bypass cache để truncate giữa các test không bị stale data.
    if (process.env.NODE_ENV === 'test') return factory();
    const hit = await this.cache.get<T>(key);
    if (hit !== undefined && hit !== null) return hit;
    const fresh = await factory();
    await this.cache.set(key, fresh, CACHE_TTL_MS);
    return fresh;
  }
}
