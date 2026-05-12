'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { hasMinRole } from '@/lib/permissions';
import { createNotification } from '@/lib/notifications';
import { auditLog } from '@/lib/audit';
import type { UserRole, EnrollmentStatus } from '@lumibach/db';

// ── List students (paginated) ─────────────────────────────────

const PAGE_SIZE = 25;

export type StudentRow = {
  id: string;
  fullName: string | null;
  firstName: string;
  lastName: string;
  email: string;
  username: string | null;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  _count: { enrollments: number };
};

export async function listStudentsAction(opts: {
  q?: string;
  courseId?: string;
  page?: number;
}): Promise<{ students: StudentRow[]; total: number; totalPages: number }> {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) return { students: [], total: 0, totalPages: 0 };

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
    prisma.user.findMany({
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
    prisma.user.count({ where }),
  ]);

  return {
    students: students as StudentRow[],
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

// ── Get courses for filter dropdown ──────────────────────────

export async function listCoursesForFilterAction(): Promise<
  { id: string; name: string; slug: string }[]
> {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  const userId = session?.user?.id;
  if (!role || !hasMinRole(role, 'TA')) return [];

  if (role === 'ADMIN') {
    return prisma.course.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  return prisma.course.findMany({
    where: {
      deletedAt: null,
      OR: [
        { ownerId: userId },
        { coTeachers: { some: { userId } } },
        { teachingAssistants: { some: { userId } } },
      ],
    },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });
}

// ── Get student detail ────────────────────────────────────────

export type StudentEnrollment = {
  id: string;
  courseId: string;
  courseName: string;
  courseSlug: string;
  status: EnrollmentStatus;
  progress: number;
  enrolledAt: Date;
  quizScore: number | null; // trung bình điểm quiz
  codeScore: number | null; // trung bình điểm code
};

export type StudentDetail = {
  id: string;
  fullName: string | null;
  firstName: string;
  lastName: string;
  email: string;
  username: string | null;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  enrollments: StudentEnrollment[];
};

export async function getStudentDetailAction(userId: string): Promise<StudentDetail | null> {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) return null;

  const student = await prisma.user.findUnique({
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

  if (!student) return null;

  // Tính điểm trung bình cho từng khóa học
  const enrollments: StudentEnrollment[] = await Promise.all(
    student.enrollments.map(async (e) => {
      const [quizAttempts, codeSubmissions] = await Promise.all([
        prisma.quizAttempt.findMany({
          where: {
            studentId: userId,
            status: 'SUBMITTED',
            quiz: { courseId: e.courseId },
          },
          select: { score: true, maxScore: true },
        }),
        prisma.codeSubmission.findMany({
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
        enrolledAt: e.enrolledAt,
        quizScore: quizScore != null ? Math.round(quizScore * 10) / 10 : null,
        codeScore: codeScore != null ? Math.round(codeScore * 10) / 10 : null,
      };
    })
  );

  return { ...student, enrollments };
}

// ── Enroll student into course (by student ID) ────────────────

export async function enrollStudentAction(
  studentId: string,
  courseId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const [student, course] = await Promise.all([
    prisma.user.findUnique({ where: { id: studentId, role: 'STUDENT', deletedAt: null } }),
    prisma.course.findUnique({ where: { id: courseId, deletedAt: null } }),
  ]);

  if (!student) return { success: false, error: 'Không tìm thấy học sinh.' };
  if (!course) return { success: false, error: 'Không tìm thấy khóa học.' };

  if (role !== 'ADMIN' && course.ownerId !== session!.user!.id) {
    // Allow co-teacher too
    const isCoTeacher = await prisma.courseCoTeacher.findFirst({
      where: { courseId, userId: session!.user!.id },
    });
    if (!isCoTeacher) return { success: false, error: 'Bạn không có quyền quản lý khóa học này.' };
  }

  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: studentId, courseId } },
  });
  if (existing) return { success: false, error: 'Học sinh đã có trong khóa học này.' };

  await prisma.enrollment.create({ data: { userId: studentId, courseId, status: 'ACTIVE' } });

  void createNotification({
    userId: studentId,
    type: 'COURSE_ENROLLED',
    title: `Bạn đã được thêm vào khóa học "${course.name}"`,
    link: `/courses/${course.slug}`,
  });

  await auditLog({
    action: 'ENROLL_STUDENT',
    userId: session!.user!.id,
    userRole: role,
    resource: 'Enrollment',
    resourceId: courseId,
    changes: { studentId, courseId },
  });

  return { success: true, message: `Đã thêm học sinh vào "${course.name}".` };
}

// ── Remove student from course ────────────────────────────────

export async function removeStudentFromCourseAction(
  enrollmentId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { course: true },
  });
  if (!enrollment) return { success: false, error: 'Không tìm thấy.' };

  if (role !== 'ADMIN' && enrollment.course.ownerId !== session!.user!.id) {
    return { success: false, error: 'Bạn không có quyền.' };
  }

  await prisma.enrollment.delete({ where: { id: enrollmentId } });
  return { success: true, message: 'Đã xóa học sinh khỏi khóa học.' };
}
