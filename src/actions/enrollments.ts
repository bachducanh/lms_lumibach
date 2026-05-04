'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import { auditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import type { UserRole, EnrollmentStatus } from '@prisma/client';
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

// ── List members ──────────────────────────────────────────────

const userSelect = { id: true, fullName: true, firstName: true, lastName: true, email: true, avatar: true };

export async function listCourseMembersAction(courseId: string) {
  const [enrollments, tas, coTeachers] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId },
      orderBy: { enrolledAt: 'asc' },
      select: { id: true, userId: true, status: true, progress: true, enrolledAt: true, user: { select: userSelect } },
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

// ── Enroll single user (by email) ─────────────────────────────

export async function enrollUserAction(
  courseId: string,
  email: string,
): Promise<ActionResult> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { success: false, error: 'Khoá học không tồn tại.' };
  if (role !== 'ADMIN' && course.ownerId !== session!.user!.id) {
    return { success: false, error: 'Bạn không có quyền quản lý khoá học này.' };
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return { success: false, error: `Không tìm thấy tài khoản: ${email}` };

  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
  });
  if (existing) return { success: false, error: `${email} đã có trong lớp.` };

  await prisma.enrollment.create({ data: { userId: user.id, courseId, status: 'ACTIVE' } });

  void createNotification({
    userId: user.id,
    type:   'COURSE_ENROLLED',
    title:  `Bạn đã được thêm vào khoá học "${course.name}"`,
    link:   `/courses/${course.slug}`,
  });

  await auditLog({
    action: 'ENROLL_USER',
    userId: session!.user!.id,
    userRole: role,
    resource: 'Enrollment',
    resourceId: courseId,
    changes: { email, courseId },
  });

  return { success: true, message: `Đã thêm ${email} vào lớp.` };
}

// ── Bulk enroll (paste emails) ────────────────────────────────

export async function bulkEnrollAction(
  courseId: string,
  emails: string[],
): Promise<ActionResult<{ enrolled: number; errors: { email: string; reason: string }[] }>> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { success: false, error: 'Khoá học không tồn tại.' };
  if (role !== 'ADMIN' && course.ownerId !== session!.user!.id) {
    return { success: false, error: 'Bạn không có quyền quản lý khoá học này.' };
  }

  const errors: { email: string; reason: string }[] = [];
  let enrolled = 0;

  for (const raw of emails) {
    const email = raw.toLowerCase().trim();
    if (!email) continue;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { errors.push({ email, reason: 'Không tìm thấy tài khoản' }); continue; }

    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
    });
    if (existing) { errors.push({ email, reason: 'Đã có trong lớp' }); continue; }

    await prisma.enrollment.create({ data: { userId: user.id, courseId, status: 'ACTIVE' } });
    enrolled++;
    void createNotification({
      userId: user.id,
      type:   'COURSE_ENROLLED',
      title:  `Bạn đã được thêm vào khoá học "${course.name}"`,
      link:   `/courses/${course.slug}`,
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
    type:   'COURSE_ENROLLED',
    title:  `Bạn đã tham gia khoá học "${course.name}"`,
    link:   `/courses/${course.slug}`,
  });

  return { success: true, message: `Đã tham gia khoá học "${course.name}".`, data: { slug: course.slug } };
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

// ── Assign TA ─────────────────────────────────────────────────

export async function assignTAAction(courseId: string, email: string): Promise<ActionResult> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { success: false, error: 'Khoá học không tồn tại.' };
  if (role !== 'ADMIN' && course.ownerId !== session!.user!.id) {
    return { success: false, error: 'Bạn không có quyền quản lý khoá học này.' };
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return { success: false, error: `Không tìm thấy tài khoản: ${email}` };
  if (user.role !== 'TA' && user.role !== 'TEACHER' && user.role !== 'ADMIN') {
    return { success: false, error: 'Chỉ có thể gán TA/Teacher làm trợ giảng.' };
  }

  const existing = await prisma.teachingAssistant.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
  });
  if (existing) return { success: false, error: `${email} đã là trợ giảng của lớp này.` };

  await prisma.teachingAssistant.create({
    data: { userId: user.id, courseId, assignedBy: session!.user!.id },
  });

  await auditLog({
    action: 'ASSIGN_TA',
    userId: session!.user!.id,
    userRole: role,
    resource: 'TeachingAssistant',
    resourceId: courseId,
    changes: { email, courseId },
  });

  return { success: true, message: `Đã gán ${email} làm trợ giảng.` };
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

// ── Add co-teacher ────────────────────────────────────────────

export async function addCoTeacherAction(courseId: string, email: string): Promise<ActionResult> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { success: false, error: 'Khoá học không tồn tại.' };
  if (role !== 'ADMIN' && course.ownerId !== session!.user!.id) {
    return { success: false, error: 'Bạn không có quyền quản lý khoá học này.' };
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return { success: false, error: `Không tìm thấy tài khoản: ${email}` };
  if (user.role !== 'TEACHER' && user.role !== 'ADMIN') {
    return { success: false, error: 'Chỉ có thể thêm tài khoản có vai trò Giáo viên.' };
  }
  if (user.id === course.ownerId) {
    return { success: false, error: 'Người dùng này đã là chủ khoá học.' };
  }

  const existing = await prisma.courseCoTeacher.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
  });
  if (existing) return { success: false, error: `${email} đã là giáo viên của khoá học này.` };

  await prisma.courseCoTeacher.create({
    data: { userId: user.id, courseId, assignedBy: session!.user!.id },
  });

  await auditLog({
    action: 'ADD_CO_TEACHER',
    userId: session!.user!.id,
    userRole: role,
    resource: 'CourseCoTeacher',
    resourceId: courseId,
    changes: { email, courseId },
  });

  return { success: true, message: `Đã thêm ${email} làm giáo viên khoá học.` };
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

export async function generateEnrollmentCodeAction(courseId: string): Promise<ActionResult<{ code: string }>> {
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
