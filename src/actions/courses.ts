'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import { auditLog } from '@/lib/audit';
import { slugify } from '@/lib/utils';
import type { UserRole, CourseStatus } from '@prisma/client';
import type { ActionResult } from './auth';

// ── Schemas ───────────────────────────────────────────────────

const courseSchema = z.object({
  name: z.string().min(3, 'Tên khoá học tối thiểu 3 ký tự'),
  shortName: z.string().max(20).optional().or(z.literal('')),
  description: z.string().optional(),
  subject: z.string().optional(),
  gradeLevel: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  isPublic: z.boolean().default(false),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type CourseFormValues = z.infer<typeof courseSchema>;

export type CourseListItem = {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
  thumbnail: string | null;
  subject: string | null;
  gradeLevel: string | null;
  status: CourseStatus;
  isPublic: boolean;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  owner: { id: string; fullName: string | null; firstName: string; lastName: string };
  _count: { enrollments: number };
};

// ── Create ────────────────────────────────────────────────────

export async function createCourseAction(
  input: CourseFormValues,
): Promise<ActionResult<{ slug: string }>> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Dữ liệu không hợp lệ.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { name, shortName, description, subject, gradeLevel, status, isPublic, startDate, endDate } = parsed.data;

  const baseSlug = slugify(name);
  if (!baseSlug) return { success: false, error: 'Tên khoá học không hợp lệ.' };

  // Ensure unique slug
  let slug = baseSlug;
  let attempt = 0;
  while (await prisma.course.findUnique({ where: { slug } })) {
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  const course = await prisma.course.create({
    data: {
      name,
      shortName: shortName || null,
      slug,
      description: description || null,
      subject: subject || null,
      gradeLevel: gradeLevel || null,
      status,
      isPublic,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      ownerId: session!.user!.id,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
    },
  });

  await auditLog({
    action: 'COURSE_CREATE',
    userId: session!.user!.id,
    userRole: role,
    resource: 'Course',
    resourceId: course.id,
    changes: { name, slug, status },
  });

  return { success: true, message: 'Tạo khoá học thành công.', data: { slug: course.slug } };
}

// ── Update ────────────────────────────────────────────────────

export async function updateCourseAction(
  id: string,
  input: CourseFormValues,
): Promise<ActionResult<{ slug: string }>> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Dữ liệu không hợp lệ.' };
  }

  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing) return { success: false, error: 'Khoá học không tồn tại.' };

  // Only owner or admin can edit
  if (role !== 'ADMIN' && existing.ownerId !== session!.user!.id) {
    return { success: false, error: 'Bạn không có quyền sửa khoá học này.' };
  }

  const { name, shortName, description, subject, gradeLevel, status, isPublic, startDate, endDate } = parsed.data;

  const publishedAt =
    status === 'PUBLISHED' && existing.status !== 'PUBLISHED' ? new Date() : existing.publishedAt;
  const archivedAt =
    status === 'ARCHIVED' && existing.status !== 'ARCHIVED' ? new Date() : existing.archivedAt;

  const course = await prisma.course.update({
    where: { id },
    data: {
      name,
      shortName: shortName || null,
      description: description || null,
      subject: subject || null,
      gradeLevel: gradeLevel || null,
      status,
      isPublic,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      publishedAt,
      archivedAt,
    },
  });

  await auditLog({
    action: 'COURSE_UPDATE',
    userId: session!.user!.id,
    userRole: role,
    resource: 'Course',
    resourceId: course.id,
    changes: { name, status },
  });

  return { success: true, message: 'Cập nhật khoá học thành công.', data: { slug: course.slug } };
}

// ── Delete (soft) ─────────────────────────────────────────────

export async function deleteCourseAction(id: string): Promise<ActionResult> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing) return { success: false, error: 'Khoá học không tồn tại.' };

  if (role !== 'ADMIN' && existing.ownerId !== session!.user!.id) {
    return { success: false, error: 'Bạn không có quyền xoá khoá học này.' };
  }

  await prisma.course.update({ where: { id }, data: { deletedAt: new Date() } });

  await auditLog({
    action: 'COURSE_DELETE',
    userId: session!.user!.id,
    userRole: role,
    resource: 'Course',
    resourceId: id,
  });

  return { success: true, message: 'Đã xoá khoá học.' };
}

// ── List (paginated) ──────────────────────────────────────────

export type CourseListParams = {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  ownOnly?: boolean;
};

export async function listCoursesAction(params: CourseListParams = {}) {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  const userId = session?.user?.id;

  const { q, status, page = 1, pageSize = 12, ownOnly } = params;

  const where = {
    deletedAt: null,
    ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
    ...(status ? { status: status as CourseStatus } : {}),
    // Students and TAs see only published courses (or enrolled ones — handled on page level)
    ...(role === 'STUDENT' || role === 'TA' ? { status: 'PUBLISHED' as CourseStatus, isPublic: true } : {}),
    ...(ownOnly && userId ? { ownerId: userId } : {}),
  };

  const [total, courses] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
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
        owner: { select: { id: true, fullName: true, firstName: true, lastName: true } },
        _count: { select: { enrollments: true } },
      },
    }),
  ]);

  return { courses: courses as CourseListItem[], total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ── Get single course ─────────────────────────────────────────

export async function getCourseBySlugAction(slug: string) {
  return prisma.course.findFirst({
    where: { slug, deletedAt: null },
    include: {
      owner: { select: { id: true, fullName: true, firstName: true, lastName: true, avatar: true } },
      _count: { select: { enrollments: true, teachingAssistants: true } },
    },
  });
}
