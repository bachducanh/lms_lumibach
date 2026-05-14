import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaClient } from '@lumibach/db';
import type {
  AssignPersonBody,
  BulkEnrollBody,
  BulkEnrollResult,
  CourseMembersResponse,
  EnrollUserBody,
  IdentifierLookupResult,
  SelfEnrollBody,
  UserCandidate,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';
import { AuditService } from '../../common/audit/audit.service';

const ROLE_ORDER = ['STUDENT', 'TA', 'TEACHER', 'ADMIN', 'SUPERADMIN'] as const;
type Role = (typeof ROLE_ORDER)[number];

function hasMinRole(userRole: string, minRole: Role): boolean {
  return ROLE_ORDER.indexOf(userRole as Role) >= ROLE_ORDER.indexOf(minRole);
}

const USER_SELECT = {
  id: true,
  fullName: true,
  firstName: true,
  lastName: true,
  email: true,
  avatar: true,
} as const;

const LOOKUP_SELECT = {
  id: true,
  fullName: true,
  firstName: true,
  lastName: true,
  email: true,
  username: true,
} as const;

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService
  ) {}

  private async findUserByIdentifier(identifier: string): Promise<IdentifierLookupResult> {
    const raw = identifier.trim();
    if (!raw) return { kind: 'notFound' };

    if (raw.includes('@')) {
      const user = await this.prisma.user.findUnique({
        where: { email: raw.toLowerCase() },
        select: LOOKUP_SELECT,
      });
      return user ? { kind: 'found', user } : { kind: 'notFound' };
    }

    const byUsername = await this.prisma.user.findFirst({
      where: { username: { equals: raw, mode: 'insensitive' } },
      select: LOOKUP_SELECT,
    });
    if (byUsername) return { kind: 'found', user: byUsername };

    const byName = await this.prisma.user.findMany({
      where: { fullName: { equals: raw, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: LOOKUP_SELECT,
    });
    if (byName.length === 0) return { kind: 'notFound' };
    if (byName.length === 1) return { kind: 'found', user: byName[0]! };
    return { kind: 'multiple', users: byName };
  }

  async resolveUser(actor: AuthUser, identifier: string): Promise<IdentifierLookupResult> {
    if (!hasMinRole(actor.role, 'TEACHER')) throw new ForbiddenException('Không có quyền');
    return this.findUserByIdentifier(identifier);
  }

  async listCourseMembers(actor: AuthUser, courseId: string): Promise<CourseMembersResponse> {
    const [enrollments, tas, coTeachers] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { courseId },
        orderBy: { enrolledAt: 'asc' },
        select: {
          id: true,
          userId: true,
          status: true,
          progress: true,
          enrolledAt: true,
          user: { select: USER_SELECT },
        },
      }),
      this.prisma.teachingAssistant.findMany({
        where: { courseId },
        orderBy: { assignedAt: 'asc' },
        select: { id: true, userId: true, assignedAt: true, user: { select: USER_SELECT } },
      }),
      this.prisma.courseCoTeacher.findMany({
        where: { courseId },
        orderBy: { assignedAt: 'asc' },
        select: { id: true, userId: true, assignedAt: true, user: { select: USER_SELECT } },
      }),
    ]);

    return {
      enrollments: enrollments.map((e) => ({
        ...e,
        enrolledAt: e.enrolledAt.toISOString(),
      })) as any,
      tas: tas.map((t) => ({ ...t, assignedAt: t.assignedAt.toISOString() })) as any,
      coTeachers: coTeachers.map((c) => ({ ...c, assignedAt: c.assignedAt.toISOString() })) as any,
    };
  }

  async enrollUser(
    actor: AuthUser,
    courseId: string,
    body: EnrollUserBody
  ): Promise<{ message: string; candidates?: UserCandidate[] }> {
    if (!hasMinRole(actor.role, 'TEACHER')) throw new ForbiddenException('Không có quyền');

    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Khoá học không tồn tại');
    if (actor.role !== 'ADMIN' && course.ownerId !== actor.id) {
      throw new ForbiddenException('Bạn không có quyền quản lý khoá học này');
    }

    let resolved: UserCandidate;
    if (body.userId) {
      const u = await this.prisma.user.findUnique({
        where: { id: body.userId },
        select: LOOKUP_SELECT,
      });
      if (!u) throw new NotFoundException('Tài khoản không tồn tại');
      resolved = u;
    } else {
      const lookup = await this.findUserByIdentifier(body.identifier);
      if (lookup.kind === 'notFound')
        throw new NotFoundException(`Không tìm thấy tài khoản: ${body.identifier}`);
      if (lookup.kind === 'multiple') {
        return {
          message: `Có ${lookup.users.length} tài khoản trùng tên`,
          candidates: lookup.users,
        };
      }
      resolved = lookup.user;
    }

    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: resolved.id, courseId } },
    });
    if (existing)
      throw new ConflictException(`${resolved.fullName ?? resolved.email} đã có trong lớp`);

    await this.prisma.enrollment.create({
      data: { userId: resolved.id, courseId, status: 'ACTIVE' },
    });

    this.prisma.notification
      .create({
        data: {
          userId: resolved.id,
          type: 'COURSE_ENROLLED',
          title: `Bạn đã được thêm vào khoá học "${course.name}"`,
          link: `/courses/${course.slug}`,
        },
      })
      .catch(() => {});

    this.audit.log({
      userId: actor.id,
      userRole: actor.role,
      action: 'ENROLL_USER',
      resource: 'Enrollment',
      resourceId: courseId,
      changes: { identifier: body.identifier, resolvedUserId: resolved.id },
    });

    return { message: `Đã thêm ${resolved.fullName ?? resolved.email} vào lớp` };
  }

  async bulkEnroll(
    actor: AuthUser,
    courseId: string,
    body: BulkEnrollBody
  ): Promise<BulkEnrollResult> {
    if (!hasMinRole(actor.role, 'TEACHER')) throw new ForbiddenException('Không có quyền');

    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Khoá học không tồn tại');
    if (actor.role !== 'ADMIN' && course.ownerId !== actor.id) {
      throw new ForbiddenException('Bạn không có quyền quản lý khoá học này');
    }

    const errors: { identifier: string; reason: string }[] = [];
    let enrolled = 0;

    for (const raw of body.identifiers) {
      const identifier = raw.trim();
      if (!identifier) continue;

      const lookup = await this.findUserByIdentifier(identifier);
      if (lookup.kind === 'notFound') {
        errors.push({ identifier, reason: 'Không tìm thấy tài khoản' });
        continue;
      }
      if (lookup.kind === 'multiple') {
        errors.push({
          identifier,
          reason: `Trùng tên (${lookup.users.length} người) — dùng email hoặc username`,
        });
        continue;
      }

      const existing = await this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: lookup.user.id, courseId } },
      });
      if (existing) {
        errors.push({ identifier, reason: 'Đã có trong lớp' });
        continue;
      }

      await this.prisma.enrollment.create({
        data: { userId: lookup.user.id, courseId, status: 'ACTIVE' },
      });
      enrolled++;
      this.prisma.notification
        .create({
          data: {
            userId: lookup.user.id,
            type: 'COURSE_ENROLLED',
            title: `Bạn đã được thêm vào khoá học "${course.name}"`,
            link: `/courses/${course.slug}`,
          },
        })
        .catch(() => {});
    }

    this.audit.log({
      userId: actor.id,
      userRole: actor.role,
      action: 'BULK_ENROLL',
      resource: 'Enrollment',
      resourceId: courseId,
      changes: { enrolled, errorCount: errors.length },
    });
    return { enrolled, errors };
  }

  async selfEnroll(actor: AuthUser, body: SelfEnrollBody): Promise<{ slug: string }> {
    const course = await this.prisma.course.findUnique({
      where: { enrollmentCode: body.code.trim() },
    });
    if (!course || course.deletedAt) throw new NotFoundException('Mã lớp học không hợp lệ');
    if (course.status !== 'PUBLISHED') throw new ForbiddenException('Khoá học chưa mở');

    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: actor.id, courseId: course.id } },
    });
    if (existing) throw new ConflictException('Bạn đã tham gia lớp này');

    await this.prisma.enrollment.create({
      data: { userId: actor.id, courseId: course.id, status: 'ACTIVE' },
    });
    this.prisma.notification
      .create({
        data: {
          userId: actor.id,
          type: 'COURSE_ENROLLED',
          title: `Bạn đã tham gia khoá học "${course.name}"`,
          link: `/courses/${course.slug}`,
        },
      })
      .catch(() => {});

    return { slug: course.slug };
  }

  async unenroll(actor: AuthUser, enrollmentId: string): Promise<void> {
    if (!hasMinRole(actor.role, 'TEACHER')) throw new ForbiddenException('Không có quyền');

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true },
    });
    if (!enrollment) throw new NotFoundException('Không tìm thấy');
    if (actor.role !== 'ADMIN' && enrollment.course.ownerId !== actor.id) {
      throw new ForbiddenException('Bạn không có quyền');
    }

    await this.prisma.enrollment.delete({ where: { id: enrollmentId } });
  }

  async assignTA(
    actor: AuthUser,
    courseId: string,
    body: AssignPersonBody
  ): Promise<{ message: string; candidates?: UserCandidate[] }> {
    if (!hasMinRole(actor.role, 'TEACHER')) throw new ForbiddenException('Không có quyền');

    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Khoá học không tồn tại');
    if (actor.role !== 'ADMIN' && course.ownerId !== actor.id) {
      throw new ForbiddenException('Bạn không có quyền quản lý khoá học này');
    }

    let resolvedId: string;
    if (body.userId) {
      const u = await this.prisma.user.findUnique({ where: { id: body.userId } });
      if (!u) throw new NotFoundException('Tài khoản không tồn tại');
      resolvedId = u.id;
    } else {
      const lookup = await this.findUserByIdentifier(body.identifier);
      if (lookup.kind === 'notFound')
        throw new NotFoundException(`Không tìm thấy: ${body.identifier}`);
      if (lookup.kind === 'multiple')
        return { message: `Trùng tên (${lookup.users.length} người).`, candidates: lookup.users };
      resolvedId = lookup.user.id;
    }

    const user = await this.prisma.user.findUnique({ where: { id: resolvedId } });
    if (!user) throw new NotFoundException('Tài khoản không tồn tại');
    if (user.role !== 'TA' && user.role !== 'TEACHER' && user.role !== 'ADMIN') {
      throw new ForbiddenException('Chỉ có thể gán TA/Teacher làm trợ giảng');
    }

    const existing = await this.prisma.teachingAssistant.findUnique({
      where: { userId_courseId: { userId: resolvedId, courseId } },
    });
    if (existing) throw new ConflictException(`${user.fullName ?? user.email} đã là trợ giảng`);

    await this.prisma.teachingAssistant.create({
      data: { userId: resolvedId, courseId, assignedBy: actor.id },
    });
    this.audit.log({
      userId: actor.id,
      userRole: actor.role,
      action: 'ASSIGN_TA',
      resource: 'TeachingAssistant',
      resourceId: courseId,
    });
    return { message: `Đã gán ${user.fullName ?? user.email} làm trợ giảng` };
  }

  async removeTA(actor: AuthUser, taId: string): Promise<void> {
    if (!hasMinRole(actor.role, 'TEACHER')) throw new ForbiddenException('Không có quyền');
    const ta = await this.prisma.teachingAssistant.findUnique({
      where: { id: taId },
      include: { course: true },
    });
    if (!ta) throw new NotFoundException('Không tìm thấy');
    if (actor.role !== 'ADMIN' && ta.course.ownerId !== actor.id)
      throw new ForbiddenException('Bạn không có quyền');
    await this.prisma.teachingAssistant.delete({ where: { id: taId } });
  }

  async addCoTeacher(
    actor: AuthUser,
    courseId: string,
    body: AssignPersonBody
  ): Promise<{ message: string; candidates?: UserCandidate[] }> {
    if (!hasMinRole(actor.role, 'TEACHER')) throw new ForbiddenException('Không có quyền');

    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Khoá học không tồn tại');
    if (actor.role !== 'ADMIN' && course.ownerId !== actor.id)
      throw new ForbiddenException('Bạn không có quyền quản lý khoá học này');

    let resolvedId: string;
    if (body.userId) {
      const u = await this.prisma.user.findUnique({ where: { id: body.userId } });
      if (!u) throw new NotFoundException('Tài khoản không tồn tại');
      resolvedId = u.id;
    } else {
      const lookup = await this.findUserByIdentifier(body.identifier);
      if (lookup.kind === 'notFound')
        throw new NotFoundException(`Không tìm thấy: ${body.identifier}`);
      if (lookup.kind === 'multiple')
        return { message: `Trùng tên (${lookup.users.length} người).`, candidates: lookup.users };
      resolvedId = lookup.user.id;
    }

    const user = await this.prisma.user.findUnique({ where: { id: resolvedId } });
    if (!user) throw new NotFoundException('Tài khoản không tồn tại');
    if (user.role !== 'TEACHER' && user.role !== 'ADMIN')
      throw new ForbiddenException('Chỉ có thể thêm tài khoản Giáo viên');
    if (user.id === course.ownerId)
      throw new ConflictException('Người dùng này đã là chủ khoá học');

    const existing = await this.prisma.courseCoTeacher.findUnique({
      where: { userId_courseId: { userId: resolvedId, courseId } },
    });
    if (existing)
      throw new ConflictException(
        `${user.fullName ?? user.email} đã là giáo viên của khoá học này`
      );

    await this.prisma.courseCoTeacher.create({
      data: { userId: resolvedId, courseId, assignedBy: actor.id },
    });
    this.audit.log({
      userId: actor.id,
      userRole: actor.role,
      action: 'ADD_CO_TEACHER',
      resource: 'CourseCoTeacher',
      resourceId: courseId,
    });
    return { message: `Đã thêm ${user.fullName ?? user.email} làm giáo viên khoá học` };
  }

  async removeCoTeacher(actor: AuthUser, coTeacherId: string): Promise<void> {
    if (!hasMinRole(actor.role, 'TEACHER')) throw new ForbiddenException('Không có quyền');
    const ct = await this.prisma.courseCoTeacher.findUnique({
      where: { id: coTeacherId },
      include: { course: true },
    });
    if (!ct) throw new NotFoundException('Không tìm thấy');
    if (actor.role !== 'ADMIN' && ct.course.ownerId !== actor.id)
      throw new ForbiddenException('Bạn không có quyền');
    await this.prisma.courseCoTeacher.delete({ where: { id: coTeacherId } });
  }

  async generateEnrollmentCode(actor: AuthUser, courseId: string): Promise<{ code: string }> {
    if (!hasMinRole(actor.role, 'TEACHER')) throw new ForbiddenException('Không có quyền');
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Khoá học không tồn tại');
    if (actor.role !== 'ADMIN' && course.ownerId !== actor.id)
      throw new ForbiddenException('Bạn không có quyền');

    const code = randomBytes(4).toString('hex').toUpperCase();
    await this.prisma.course.update({ where: { id: courseId }, data: { enrollmentCode: code } });
    return { code };
  }
}
