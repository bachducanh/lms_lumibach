'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import type { ActivityAction, UserRole } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────

export type ActivityLogRow = {
  id:           string;
  action:       ActivityAction;
  resourceType: string | null;
  resourceId:   string | null;
  resourceName: string | null;
  ipAddress:    string | null;
  createdAt:    Date;
  user: {
    id:        string;
    fullName:  string | null;
    firstName: string;
    lastName:  string;
    email:     string;
    role:      string;
  };
  course: { id: string; name: string; slug: string } | null;
};

export type ActivityLogPage = {
  rows:  ActivityLogRow[];
  total: number;
  page:  number;
  pages: number;
};

const PAGE_SIZE = 30;

// ── Course-level logs (Teacher / TA / Admin) ──────────────────

export type CourseLogFilters = {
  userId?:   string;
  action?:   ActivityAction;
  dateFrom?: string;
  dateTo?:   string;
  page?:     number;
};

export async function getCourseLogsAction(
  courseSlug: string,
  filters: CourseLogFilters = {},
): Promise<ActivityLogPage | null> {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!session?.user?.id || !role || !hasMinRole(role, 'TA')) return null;

  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true, ownerId: true },
  });
  if (!course) return null;

  // Teachers can only view their own course logs (unless ADMIN)
  if (role === 'TEACHER' && course.ownerId !== session.user.id) return null;

  const page = Math.max(1, filters.page ?? 1);
  const where = {
    courseId: course.id,
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.dateFrom || filters.dateTo ? {
      createdAt: {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo   ? { lte: new Date(filters.dateTo + 'T23:59:59') } : {}),
      },
    } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:  (page - 1) * PAGE_SIZE,
      take:  PAGE_SIZE,
      include: {
        user:   { select: { id: true, fullName: true, firstName: true, lastName: true, email: true, role: true } },
        course: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return { rows: rows as ActivityLogRow[], total, page, pages: Math.ceil(total / PAGE_SIZE) };
}

// ── System-wide logs (Admin only) ─────────────────────────────

export type SystemLogFilters = {
  userId?:   string;
  courseId?: string;
  action?:   ActivityAction;
  dateFrom?: string;
  dateTo?:   string;
  q?:        string;
  page?:     number;
};

export async function getSystemLogsAction(
  filters: SystemLogFilters = {},
): Promise<ActivityLogPage | null> {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!session?.user?.id || role !== 'ADMIN') return null;

  const page = Math.max(1, filters.page ?? 1);

  let userIds: string[] | undefined;
  if (filters.q) {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { fullName:  { contains: filters.q, mode: 'insensitive' } },
          { email:     { contains: filters.q, mode: 'insensitive' } },
          { firstName: { contains: filters.q, mode: 'insensitive' } },
          { lastName:  { contains: filters.q, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    userIds = users.map((u) => u.id);
    if (userIds.length === 0) return { rows: [], total: 0, page, pages: 0 };
  }

  const where = {
    ...(filters.userId   ? { userId: filters.userId }     : {}),
    ...(userIds          ? { userId: { in: userIds } }    : {}),
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(filters.action   ? { action: filters.action }     : {}),
    ...(filters.dateFrom || filters.dateTo ? {
      createdAt: {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo   ? { lte: new Date(filters.dateTo + 'T23:59:59') } : {}),
      },
    } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:  (page - 1) * PAGE_SIZE,
      take:  PAGE_SIZE,
      include: {
        user:   { select: { id: true, fullName: true, firstName: true, lastName: true, email: true, role: true } },
        course: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return { rows: rows as ActivityLogRow[], total, page, pages: Math.ceil(total / PAGE_SIZE) };
}

// ── Per-student logs ──────────────────────────────────────────

export type StudentLogFilters = {
  courseId?: string;
  action?:   ActivityAction;
  dateFrom?: string;
  dateTo?:   string;
  page?:     number;
};

export async function getStudentLogsAction(
  targetUserId: string,
  filters: StudentLogFilters = {},
): Promise<ActivityLogPage | null> {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!session?.user?.id || !role || !hasMinRole(role, 'TA')) return null;

  const page = Math.max(1, filters.page ?? 1);
  const where = {
    userId: targetUserId,
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(filters.action   ? { action: filters.action }     : {}),
    ...(filters.dateFrom || filters.dateTo ? {
      createdAt: {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo   ? { lte: new Date(filters.dateTo + 'T23:59:59') } : {}),
      },
    } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:  (page - 1) * PAGE_SIZE,
      take:  PAGE_SIZE,
      include: {
        user:   { select: { id: true, fullName: true, firstName: true, lastName: true, email: true, role: true } },
        course: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return { rows: rows as ActivityLogRow[], total, page, pages: Math.ceil(total / PAGE_SIZE) };
}

// ── Get courses for filter (teacher sees own, admin sees all) ─

export async function getCoursesForLogFilterAction() {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!session?.user?.id || !role || !hasMinRole(role, 'TA')) return [];

  if (role === 'ADMIN') {
    return prisma.course.findMany({
      where:   { deletedAt: null },
      select:  { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  return prisma.course.findMany({
    where:   { deletedAt: null, ownerId: session.user.id },
    select:  { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });
}
