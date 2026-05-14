import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@lumibach/db';
import type {
  CreateUserBody,
  ImportRow,
  ImportResult,
  StudentDetail,
  StudentRow,
  UpdateProfileBody,
  UpdateUserBody,
} from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';
import { AuditService } from '../../common/audit/audit.service';

const PAGE_SIZE = 25;
const ROLE_ORDER = ['STUDENT', 'TA', 'TEACHER', 'ADMIN', 'SUPERADMIN'] as const;
type Role = (typeof ROLE_ORDER)[number];

function hasMinRole(userRole: string, minRole: Role): boolean {
  return ROLE_ORDER.indexOf(userRole as Role) >= ROLE_ORDER.indexOf(minRole);
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts.length > 1 ? parts.slice(0, -1).join(' ') : fullName,
    lastName: parts.at(-1) ?? '',
  };
}

function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  let pwd =
    (upper[Math.floor(Math.random() * upper.length)] ?? 'A') +
    (digits[Math.floor(Math.random() * digits.length)] ?? '2');
  for (let i = 0; i < 6; i++) {
    pwd += all[Math.floor(Math.random() * all.length)] ?? 'a';
  }
  return pwd
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService
  ) {}

  // ── Admin: create user ─────────────────────────────────────────

  async createUser(
    actor: AuthUser,
    body: CreateUserBody
  ): Promise<{ password: string; userId: string }> {
    if (!hasMinRole(actor.role, 'ADMIN')) throw new ForbiddenException('Không có quyền');

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: body.email }, ...(body.username ? [{ username: body.username }] : [])],
        deletedAt: null,
      },
    });
    if (existing) {
      const field = existing.email === body.email ? 'Email' : 'Tên đăng nhập';
      throw new ConflictException(`${field} này đã được sử dụng`);
    }

    const plainPassword = body.password || generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 12);
    const { firstName, lastName } = splitName(body.fullName);

    const user = await this.prisma.user.create({
      data: {
        email: body.email,
        fullName: body.fullName,
        firstName,
        lastName,
        passwordHash,
        role: body.role as any,
        status: 'ACTIVE',
        emailVerified: new Date(),
        ...(body.phone ? { phone: body.phone } : {}),
        ...(body.username ? { username: body.username } : {}),
      },
    });

    this.audit.log({
      userId: actor.id,
      userRole: actor.role,
      action: 'CREATE_USER',
      resource: 'User',
      resourceId: user.id,
      changes: { email: body.email, role: body.role, fullName: body.fullName },
    });

    return { password: plainPassword, userId: user.id };
  }

  // ── Admin: update user ─────────────────────────────────────────

  async updateUser(actor: AuthUser, userId: string, body: UpdateUserBody): Promise<void> {
    if (!hasMinRole(actor.role, 'ADMIN')) throw new ForbiddenException('Không có quyền');

    const before = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!before || before.deletedAt) throw new NotFoundException('Không tìm thấy người dùng');

    const data: Record<string, unknown> = {};
    if (body.fullName) {
      data.fullName = body.fullName;
      const { firstName, lastName } = splitName(body.fullName);
      data.firstName = firstName;
      data.lastName = lastName;
    }
    if (body.role) data.role = body.role;
    if (body.status) data.status = body.status;
    if (body.phone !== undefined) data.phone = body.phone || null;
    if (body.username !== undefined) data.username = body.username || null;

    await this.prisma.user.update({ where: { id: userId }, data });

    this.audit.log({
      userId: actor.id,
      userRole: actor.role,
      action: 'UPDATE_USER',
      resource: 'User',
      resourceId: userId,
      changes: { before: { role: before.role, status: before.status }, after: data },
    });
  }

  // ── Admin: soft delete ─────────────────────────────────────────

  async softDeleteUser(actor: AuthUser, userId: string): Promise<void> {
    if (!hasMinRole(actor.role, 'ADMIN')) throw new ForbiddenException('Không có quyền');
    if (actor.id === userId) throw new ForbiddenException('Không thể xóa chính tài khoản của bạn');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('Không tìm thấy người dùng');

    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });

    this.audit.log({
      userId: actor.id,
      userRole: actor.role,
      action: 'DELETE_USER',
      resource: 'User',
      resourceId: userId,
    });
  }

  // ── Admin: reset password ──────────────────────────────────────

  async resetPassword(actor: AuthUser, userId: string): Promise<{ password: string }> {
    if (!hasMinRole(actor.role, 'ADMIN')) throw new ForbiddenException('Không có quyền');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('Không tìm thấy người dùng');

    const newPassword = generatePassword();
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    this.audit.log({
      userId: actor.id,
      userRole: actor.role,
      action: 'RESET_PASSWORD',
      resource: 'User',
      resourceId: userId,
    });

    return { password: newPassword };
  }

  // ── Admin: import users ────────────────────────────────────────

  async importUsers(actor: AuthUser, rows: ImportRow[]): Promise<ImportResult> {
    if (!hasMinRole(actor.role, 'ADMIN')) throw new ForbiddenException('Không có quyền');

    const result: ImportResult = { success: 0, errors: [], passwords: [], enrollments: [] };

    const allSlugs = [
      ...new Set(
        rows
          .flatMap((r) => r.courseSlugs ?? [])
          .map((s) => s.trim())
          .filter(Boolean)
      ),
    ];
    const courses = allSlugs.length
      ? await this.prisma.course.findMany({
          where: { slug: { in: allSlugs }, deletedAt: null },
          select: { id: true, slug: true },
        })
      : [];
    const courseBySlug = new Map(courses.map((c) => [c.slug, c]));

    for (const [i, row] of rows.entries()) {
      const rowNum = i + 2;

      if (!row.email || !row.fullName) {
        result.errors.push({
          row: rowNum,
          email: row.email || '',
          reason: 'Thiếu họ tên hoặc email',
        });
        continue;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        result.errors.push({ row: rowNum, email: row.email, reason: 'Email không hợp lệ' });
        continue;
      }

      const existing = await this.prisma.user.findUnique({ where: { email: row.email } });
      if (existing) {
        result.errors.push({ row: rowNum, email: row.email, reason: 'Email đã tồn tại' });
        continue;
      }

      const usePassword =
        row.password && row.password.length >= 6 ? row.password : generatePassword();
      const passwordHash = await bcrypt.hash(usePassword, 12);
      const { firstName, lastName } = splitName(row.fullName);

      const created = await this.prisma.user.create({
        data: {
          email: row.email,
          fullName: row.fullName,
          firstName,
          lastName,
          passwordHash,
          role: (row.role ?? 'STUDENT') as any,
          status: 'ACTIVE',
          emailVerified: new Date(),
          ...(row.username ? { username: row.username } : {}),
        },
      });

      const wanted = (row.courseSlugs ?? []).map((s) => s.trim()).filter(Boolean);
      const enrolled: string[] = [];
      const missing: string[] = [];
      for (const slug of wanted) {
        const c = courseBySlug.get(slug);
        if (!c) {
          missing.push(slug);
          continue;
        }
        try {
          await this.prisma.enrollment.create({
            data: { userId: created.id, courseId: c.id, status: 'ACTIVE' },
          });
          enrolled.push(slug);
        } catch {
          enrolled.push(slug);
        }
      }
      if (wanted.length) result.enrollments.push({ email: row.email, enrolled, missing });

      result.success++;
      result.passwords.push({ fullName: row.fullName, email: row.email, password: usePassword });
    }

    this.audit.log({
      userId: actor.id,
      userRole: actor.role,
      action: 'IMPORT_USERS',
      metadata: { total: rows.length, success: result.success, errors: result.errors.length },
    });

    return result;
  }

  // ── Update own profile ─────────────────────────────────────────

  async updateProfile(actor: AuthUser, body: UpdateProfileBody): Promise<void> {
    const data: Record<string, unknown> = {};
    if (body.fullName) {
      data.fullName = body.fullName;
      const { firstName, lastName } = splitName(body.fullName);
      data.firstName = firstName;
      data.lastName = lastName;
    }
    if (body.phone !== undefined) data.phone = body.phone || null;
    if (body.username !== undefined) data.username = body.username || null;

    await this.prisma.user.update({ where: { id: actor.id }, data });
  }

  // ── Students list ──────────────────────────────────────────────

  async listStudents(
    actor: AuthUser,
    opts: { q?: string; courseId?: string; page?: number }
  ): Promise<{ students: StudentRow[]; total: number; totalPages: number }> {
    if (!hasMinRole(actor.role, 'TA')) throw new ForbiddenException('Không có quyền');

    const { q = '', courseId = '', page = 1 } = opts;

    const where = {
      role: 'STUDENT' as const,
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' as const } },
              { email: { contains: q, mode: 'insensitive' as const } },
              { username: { contains: q, mode: 'insensitive' as const } },
              { firstName: { contains: q, mode: 'insensitive' as const } },
              { lastName: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(courseId ? { enrollments: { some: { courseId } } } : {}),
    };

    const [students, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          firstName: true,
          lastName: true,
          email: true,
          username: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          _count: { select: { enrollments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      students: students.map((s) => ({
        ...s,
        lastLoginAt: s.lastLoginAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      })) as StudentRow[],
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    };
  }

  // ── Students: courses for filter dropdown ──────────────────────

  async listCoursesForFilter(
    actor: AuthUser
  ): Promise<{ id: string; name: string; slug: string }[]> {
    if (!hasMinRole(actor.role, 'TA')) throw new ForbiddenException('Không có quyền');

    if (actor.role === 'ADMIN') {
      return this.prisma.course.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
      });
    }

    return this.prisma.course.findMany({
      where: {
        deletedAt: null,
        OR: [
          { ownerId: actor.id },
          { coTeachers: { some: { userId: actor.id } } },
          { teachingAssistants: { some: { userId: actor.id } } },
        ],
      },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  // ── Students: detail ────────────────────────────────────────────

  async getStudentDetail(actor: AuthUser, userId: string): Promise<StudentDetail> {
    if (!hasMinRole(actor.role, 'TA')) throw new ForbiddenException('Không có quyền');

    const student = await this.prisma.user.findUnique({
      where: { id: userId, role: 'STUDENT', deletedAt: null },
      select: {
        id: true,
        fullName: true,
        firstName: true,
        lastName: true,
        email: true,
        username: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        enrollments: {
          where: { course: { deletedAt: null } },
          select: {
            id: true,
            courseId: true,
            status: true,
            progress: true,
            enrolledAt: true,
            course: { select: { name: true, slug: true } },
          },
          orderBy: { enrolledAt: 'desc' },
        },
      },
    });
    if (!student) throw new NotFoundException('Không tìm thấy học sinh');

    const enrollments = await Promise.all(
      student.enrollments.map(async (e) => {
        const [quizAttempts, codeSubmissions] = await Promise.all([
          this.prisma.quizAttempt.findMany({
            where: { studentId: userId, status: 'SUBMITTED', quiz: { courseId: e.courseId } },
            select: { score: true, maxScore: true },
          }),
          this.prisma.codeSubmission.findMany({
            where: {
              studentId: userId,
              codeExercise: { courseId: e.courseId },
              score: { not: null },
            },
            select: { score: true, maxScore: true },
            orderBy: { submittedAt: 'desc' },
            distinct: ['codeExerciseId'],
          }),
        ]);

        const quizScore =
          quizAttempts.length > 0
            ? quizAttempts.reduce((sum, a) => {
                if (a.score == null || a.maxScore == null || a.maxScore === 0) return sum;
                return sum + (a.score / a.maxScore) * 10;
              }, 0) / quizAttempts.length
            : null;

        const codeScore =
          codeSubmissions.length > 0
            ? codeSubmissions.reduce((sum, s) => {
                if (s.score == null || s.maxScore == null || s.maxScore === 0) return sum;
                return sum + (s.score / s.maxScore) * 10;
              }, 0) / codeSubmissions.length
            : null;

        return {
          id: e.id,
          courseId: e.courseId,
          courseName: e.course.name,
          courseSlug: e.course.slug,
          status: e.status,
          progress: e.progress,
          enrolledAt: e.enrolledAt.toISOString(),
          quizScore: quizScore != null ? Math.round(quizScore * 10) / 10 : null,
          codeScore: codeScore != null ? Math.round(codeScore * 10) / 10 : null,
        };
      })
    );

    return {
      id: student.id,
      fullName: student.fullName,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      username: student.username,
      status: student.status,
      lastLoginAt: student.lastLoginAt?.toISOString() ?? null,
      createdAt: student.createdAt.toISOString(),
      enrollments,
    };
  }
}
