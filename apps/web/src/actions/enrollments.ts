'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import { auditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import type { UserRole, EnrollmentStatus } from '@lumibach/db';
import type { ActionResult } from './auth';
import { randomBytes } from 'crypto';

// ── Types ─────────────────────────────────────────────────────

export type CourseMember = {
  id: string;
  userId: string;
  user: {
    id: string;
    fullName: string | null;
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
  };
  status: EnrollmentStatus;
  progress: number;
  enrolledAt: Date;
};

export type CourseTA = {
  id: string;
  userId: string;
  user: {
    id: string;
    fullName: string | null;
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
  };
  assignedAt: Date;
};

export type CourseCoTeacher = {
  id: string;
  userId: string;
  user: {
    id: string;
    fullName: string | null;
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
  };
  assignedAt: Date;
};

// ── Identifier resolution ─────────────────────────────────────
// Lets teachers add a user by typing email, username, or full name (case-insensitive).
// Email always wins (unique). Username is unique and exact. Full name may collide —
// when it does we surface the candidates so the caller can let the user pick.

export type UserCandidate = {
  id: string;
  fullName: string | null;
  firstName: string;
  lastName: string;
  email: string;
  username: string | null;
};

export type IdentifierLookup =
  | { kind: 'found'; user: UserCandidate }
  | { kind: 'multiple'; users: UserCandidate[] }
  | { kind: 'notFound' };

const lookupSelect = {
  id: true,
  fullName: true,
  firstName: true,
  lastName: true,
  email: true,
  username: true,
};

async function findUserByIdentifier(identifier: string): Promise<IdentifierLookup> {
  const raw = identifier.trim();
  if (!raw) return { kind: 'notFound' };

  // 1. Looks like an email → exact match (case-insensitive via lowercased storage)
  if (raw.includes('@')) {
    const user = await prisma.user.findUnique({
      where: { email: raw.toLowerCase() },
      select: lookupSelect,
    });
    return user ? { kind: 'found', user } : { kind: 'notFound' };
  }

  // 2. Try username (unique). Stored case-insensitively in some setups; do equals first then iexact.
  const byUsername = await prisma.user.findFirst({
    where: { username: { equals: raw, mode: 'insensitive' } },
    select: lookupSelect,
  });
  if (byUsername) return { kind: 'found', user: byUsername };

  // 3. Fall back to full-name match (insensitive). Requires exact full name; collisions go to the
  //    caller as `multiple` so the UI can show a disambiguation picker.
  const byName = await prisma.user.findMany({
    where: { fullName: { equals: raw, mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' },
    take: 10,
    select: lookupSelect,
  });
  if (byName.length === 0) return { kind: 'notFound' };
  if (byName.length === 1) return { kind: 'found', user: byName[0]! };
  return { kind: 'multiple', users: byName };
}

// Used by the UI's auto-complete picker (modal of candidates).
export async function resolveUserIdentifierAction(identifier: string): Promise<IdentifierLookup> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { kind: 'notFound' };
  return findUserByIdentifier(identifier);
}

// ── List members ──────────────────────────────────────────────

const userSelect = {
  id: true,
  fullName: true,
  firstName: true,
  lastName: true,
  email: true,
  avatar: true,
};

export async function listCourseMembersAction(courseId: string) {
  const [enrollments, tas, coTeachers] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId },
      orderBy: { enrolledAt: 'asc' },
      select: {
        id: true,
        userId: true,
        status: true,
        progress: true,
        enrolledAt: true,
        user: { select: userSelect },
      },
    }),
    prisma.teachingAssistant.findMany({
      where: { courseId },
      orderBy: { assignedAt: 'asc' },
      select: { id: true, userId: true, assignedAt: true, user: { select: userSelect } },
    }),
    prisma.courseCoTeacher.findMany({
      where: { courseId },
      orderBy: { assignedAt: 'asc' },
      select: { id: true, userId: true, assignedAt: true, user: { select: userSelect } },
    }),
  ]);

  return {
    enrollments: enrollments as CourseMember[],
    tas: tas as CourseTA[],
    coTeachers: coTeachers as CourseCoTeacher[],
  };
}

// ── Enroll single user (by email / username / full name) ──────

export type EnrollResult =
  | { success: true; message: string }
  | { success: false; error: string; candidates?: UserCandidate[] };

export async function enrollUserAction(
  courseId: string,
  identifier: string,
  /** When the user picks from a disambiguation list, the UI re-submits with userId. */
  userId?: string
): Promise<EnrollResult> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { success: false, error: 'Khoá học không tồn tại.' };
  if (role !== 'ADMIN' && course.ownerId !== session!.user!.id) {
    return { success: false, error: 'Bạn không có quyền quản lý khoá học này.' };
  }

  let resolved: UserCandidate;
  if (userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: lookupSelect });
    if (!u) return { success: false, error: 'Tài khoản không tồn tại.' };
    resolved = u;
  } else {
    const lookup = await findUserByIdentifier(identifier);
    if (lookup.kind === 'notFound') {
      return { success: false, error: `Không tìm thấy tài khoản: ${identifier}` };
    }
    if (lookup.kind === 'multiple') {
      return {
        success: false,
        error: `Có ${lookup.users.length} tài khoản trùng tên — chọn đúng người trong danh sách.`,
        candidates: lookup.users,
      };
    }
    resolved = lookup.user;
  }

  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: resolved.id, courseId } },
  });
  if (existing) {
    return { success: false, error: `${resolved.fullName ?? resolved.email} đã có trong lớp.` };
  }

  await prisma.enrollment.create({ data: { userId: resolved.id, courseId, status: 'ACTIVE' } });

  void createNotification({
    userId: resolved.id,
    type: 'COURSE_ENROLLED',
    title: `Bạn đã được thêm vào khoá học "${course.name}"`,
    link: `/courses/${course.slug}`,
  });

  await auditLog({
    action: 'ENROLL_USER',
    userId: session!.user!.id,
    userRole: role,
    resource: 'Enrollment',
    resourceId: courseId,
    changes: { identifier, resolvedUserId: resolved.id, courseId },
  });

  return { success: true, message: `Đã thêm ${resolved.fullName ?? resolved.email} vào lớp.` };
}

// ── Bulk enroll (paste any mix of emails / usernames / full names) ──

export async function bulkEnrollAction(
  courseId: string,
  identifiers: string[]
): Promise<ActionResult<{ enrolled: number; errors: { identifier: string; reason: string }[] }>> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { success: false, error: 'Khoá học không tồn tại.' };
  if (role !== 'ADMIN' && course.ownerId !== session!.user!.id) {
    return { success: false, error: 'Bạn không có quyền quản lý khoá học này.' };
  }

  const errors: { identifier: string; reason: string }[] = [];
  let enrolled = 0;

  for (const raw of identifiers) {
    const identifier = raw.trim();
    if (!identifier) continue;

    const lookup = await findUserByIdentifier(identifier);
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

    const user = lookup.user;
    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
    });
    if (existing) {
      errors.push({ identifier, reason: 'Đã có trong lớp' });
      continue;
    }

    await prisma.enrollment.create({ data: { userId: user.id, courseId, status: 'ACTIVE' } });
    enrolled++;
    void createNotification({
      userId: user.id,
      type: 'COURSE_ENROLLED',
      title: `Bạn đã được thêm vào khoá học "${course.name}"`,
      link: `/courses/${course.slug}`,
    });
  }

  await auditLog({
    action: 'BULK_ENROLL',
    userId: session!.user!.id,
    userRole: role,
    resource: 'Enrollment',
    resourceId: courseId,
    changes: { enrolled, errorCount: errors.length },
  });

  return {
    success: true,
    message: `Đã thêm ${enrolled} học sinh.`,
    data: { enrolled, errors },
  };
}

// ── Self-enroll via enrollment code ───────────────────────────

export async function selfEnrollAction(code: string): Promise<ActionResult<{ slug: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };

  const course = await prisma.course.findUnique({
    where: { enrollmentCode: code.trim() },
  });
  if (!course || course.deletedAt) return { success: false, error: 'Mã lớp học không hợp lệ.' };
  if (course.status !== 'PUBLISHED') return { success: false, error: 'Khoá học chưa mở.' };

  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
  });
  if (existing) return { success: false, error: 'Bạn đã tham gia lớp này.' };

  await prisma.enrollment.create({
    data: { userId: session.user.id, courseId: course.id, status: 'ACTIVE' },
  });

  void createNotification({
    userId: session.user.id,
    type: 'COURSE_ENROLLED',
    title: `Bạn đã tham gia khoá học "${course.name}"`,
    link: `/courses/${course.slug}`,
  });

  return {
    success: true,
    message: `Đã tham gia khoá học "${course.name}".`,
    data: { slug: course.slug },
  };
}

// ── Unenroll ──────────────────────────────────────────────────

export async function unenrollAction(enrollmentId: string): Promise<ActionResult> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { course: true },
  });
  if (!enrollment) return { success: false, error: 'Không tìm thấy.' };
  if (role !== 'ADMIN' && enrollment.course.ownerId !== session!.user!.id) {
    return { success: false, error: 'Bạn không có quyền.' };
  }

  await prisma.enrollment.delete({ where: { id: enrollmentId } });

  return { success: true, message: 'Đã xoá học sinh khỏi lớp.' };
}

// ── Assign TA (by email / username / full name) ────────────────

export async function assignTAAction(
  courseId: string,
  identifier: string,
  userId?: string
): Promise<EnrollResult> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { success: false, error: 'Khoá học không tồn tại.' };
  if (role !== 'ADMIN' && course.ownerId !== session!.user!.id) {
    return { success: false, error: 'Bạn không có quyền quản lý khoá học này.' };
  }

  let resolvedId: string;
  if (userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!u) return { success: false, error: 'Tài khoản không tồn tại.' };
    resolvedId = u.id;
  } else {
    const lookup = await findUserByIdentifier(identifier);
    if (lookup.kind === 'notFound')
      return { success: false, error: `Không tìm thấy: ${identifier}` };
    if (lookup.kind === 'multiple') {
      return {
        success: false,
        error: `Trùng tên (${lookup.users.length} người).`,
        candidates: lookup.users,
      };
    }
    resolvedId = lookup.user.id;
  }

  const user = await prisma.user.findUnique({ where: { id: resolvedId } });
  if (!user) return { success: false, error: 'Tài khoản không tồn tại.' };
  if (user.role !== 'TA' && user.role !== 'TEACHER' && user.role !== 'ADMIN') {
    return { success: false, error: 'Chỉ có thể gán TA/Teacher làm trợ giảng.' };
  }

  const existing = await prisma.teachingAssistant.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
  });
  if (existing)
    return { success: false, error: `${user.fullName ?? user.email} đã là trợ giảng của lớp này.` };

  await prisma.teachingAssistant.create({
    data: { userId: user.id, courseId, assignedBy: session!.user!.id },
  });

  await auditLog({
    action: 'ASSIGN_TA',
    userId: session!.user!.id,
    userRole: role,
    resource: 'TeachingAssistant',
    resourceId: courseId,
    changes: { identifier, resolvedUserId: user.id, courseId },
  });

  return { success: true, message: `Đã gán ${user.fullName ?? user.email} làm trợ giảng.` };
}

// ── Remove TA ─────────────────────────────────────────────────

export async function removeTAAction(taId: string): Promise<ActionResult> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const ta = await prisma.teachingAssistant.findUnique({
    where: { id: taId },
    include: { course: true },
  });
  if (!ta) return { success: false, error: 'Không tìm thấy.' };
  if (role !== 'ADMIN' && ta.course.ownerId !== session!.user!.id) {
    return { success: false, error: 'Bạn không có quyền.' };
  }

  await prisma.teachingAssistant.delete({ where: { id: taId } });

  return { success: true, message: 'Đã xoá trợ giảng.' };
}

// ── Add co-teacher (by email / username / full name) ──────────

export async function addCoTeacherAction(
  courseId: string,
  identifier: string,
  userId?: string
): Promise<EnrollResult> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { success: false, error: 'Khoá học không tồn tại.' };
  if (role !== 'ADMIN' && course.ownerId !== session!.user!.id) {
    return { success: false, error: 'Bạn không có quyền quản lý khoá học này.' };
  }

  let resolvedId: string;
  if (userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!u) return { success: false, error: 'Tài khoản không tồn tại.' };
    resolvedId = u.id;
  } else {
    const lookup = await findUserByIdentifier(identifier);
    if (lookup.kind === 'notFound')
      return { success: false, error: `Không tìm thấy: ${identifier}` };
    if (lookup.kind === 'multiple') {
      return {
        success: false,
        error: `Trùng tên (${lookup.users.length} người).`,
        candidates: lookup.users,
      };
    }
    resolvedId = lookup.user.id;
  }

  const user = await prisma.user.findUnique({ where: { id: resolvedId } });
  if (!user) return { success: false, error: 'Tài khoản không tồn tại.' };
  if (user.role !== 'TEACHER' && user.role !== 'ADMIN') {
    return { success: false, error: 'Chỉ có thể thêm tài khoản có vai trò Giáo viên.' };
  }
  if (user.id === course.ownerId) {
    return { success: false, error: 'Người dùng này đã là chủ khoá học.' };
  }

  const existing = await prisma.courseCoTeacher.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
  });
  if (existing)
    return {
      success: false,
      error: `${user.fullName ?? user.email} đã là giáo viên của khoá học này.`,
    };

  await prisma.courseCoTeacher.create({
    data: { userId: user.id, courseId, assignedBy: session!.user!.id },
  });

  await auditLog({
    action: 'ADD_CO_TEACHER',
    userId: session!.user!.id,
    userRole: role,
    resource: 'CourseCoTeacher',
    resourceId: courseId,
    changes: { identifier, resolvedUserId: user.id, courseId },
  });

  return {
    success: true,
    message: `Đã thêm ${user.fullName ?? user.email} làm giáo viên khoá học.`,
  };
}

// ── Remove co-teacher ─────────────────────────────────────────

export async function removeCoTeacherAction(coTeacherId: string): Promise<ActionResult> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const coTeacher = await prisma.courseCoTeacher.findUnique({
    where: { id: coTeacherId },
    include: { course: true },
  });
  if (!coTeacher) return { success: false, error: 'Không tìm thấy.' };
  if (role !== 'ADMIN' && coTeacher.course.ownerId !== session!.user!.id) {
    return { success: false, error: 'Bạn không có quyền.' };
  }

  await prisma.courseCoTeacher.delete({ where: { id: coTeacherId } });

  return { success: true, message: 'Đã xoá giáo viên khỏi khoá học.' };
}

// ── Generate enrollment code ───────────────────────────────────

export async function generateEnrollmentCodeAction(
  courseId: string
): Promise<ActionResult<{ code: string }>> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { success: false, error: 'Khoá học không tồn tại.' };
  if (role !== 'ADMIN' && course.ownerId !== session!.user!.id) {
    return { success: false, error: 'Bạn không có quyền.' };
  }

  const code = randomBytes(4).toString('hex').toUpperCase(); // VD: A3F2C1B9

  await prisma.course.update({ where: { id: courseId }, data: { enrollmentCode: code } });

  return { success: true, message: 'Đã tạo mã tham gia mới.', data: { code } };
}
