'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import { auditLog } from '@/lib/audit';
import type { UserRole } from '@prisma/client';
import type { ActionResult } from './auth';

// ── Helpers ───────────────────────────────────────────────────

async function assertCanManageCourse(courseId: string) {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { error: 'Không có quyền.' as string, session: null, role };
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { error: 'Khoá học không tồn tại.', session: null, role };
  if (role !== 'ADMIN' && course.ownerId !== session!.user!.id)
    return { error: 'Bạn không có quyền quản lý khoá học này.', session: null, role };
  return { error: null, session: session!, role };
}

// ── Schemas ───────────────────────────────────────────────────

const moduleSchema = z.object({
  name: z.string().min(1, 'Tên chương không được trống'),
  description: z.string().optional(),
});

// ── Module CRUD ───────────────────────────────────────────────

export async function createModuleAction(
  courseId: string,
  input: z.infer<typeof moduleSchema>,
): Promise<ActionResult<{ id: string }>> {
  const { error, session, role } = await assertCanManageCourse(courseId);
  if (error) return { success: false, error };

  const parsed = moduleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Dữ liệu không hợp lệ.' };

  const last = await prisma.module.findFirst({
    where: { courseId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (last?.position ?? -1) + 1;

  const module = await prisma.module.create({
    data: { courseId, name: parsed.data.name, description: parsed.data.description ?? null, position },
  });

  await auditLog({ action: 'MODULE_CREATE', userId: session!.user!.id, userRole: role, resource: 'Module', resourceId: module.id });

  return { success: true, message: 'Đã tạo chương mới.', data: { id: module.id } };
}

export async function updateModuleAction(
  id: string,
  input: z.infer<typeof moduleSchema>,
): Promise<ActionResult> {
  const mod = await prisma.module.findUnique({ where: { id } });
  if (!mod) return { success: false, error: 'Chương không tồn tại.' };

  const { error } = await assertCanManageCourse(mod.courseId);
  if (error) return { success: false, error };

  const parsed = moduleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Dữ liệu không hợp lệ.' };

  await prisma.module.update({
    where: { id },
    data: { name: parsed.data.name, description: parsed.data.description ?? null },
  });

  return { success: true, message: 'Đã cập nhật chương.' };
}

export async function deleteModuleAction(id: string): Promise<ActionResult> {
  const mod = await prisma.module.findUnique({ where: { id } });
  if (!mod) return { success: false, error: 'Chương không tồn tại.' };

  const { error } = await assertCanManageCourse(mod.courseId);
  if (error) return { success: false, error };

  await prisma.module.delete({ where: { id } });
  return { success: true, message: 'Đã xoá chương.' };
}

export async function toggleModulePublishAction(id: string): Promise<ActionResult> {
  const mod = await prisma.module.findUnique({ where: { id } });
  if (!mod) return { success: false, error: 'Chương không tồn tại.' };

  const { error } = await assertCanManageCourse(mod.courseId);
  if (error) return { success: false, error };

  await prisma.module.update({ where: { id }, data: { isPublished: !mod.isPublished } });
  return { success: true, message: mod.isPublished ? 'Đã ẩn chương.' : 'Đã xuất bản chương.' };
}

export async function reorderModulesAction(courseId: string, orderedIds: string[]): Promise<ActionResult> {
  const { error } = await assertCanManageCourse(courseId);
  if (error) return { success: false, error };

  await Promise.all(
    orderedIds.map((id, index) =>
      prisma.module.update({ where: { id }, data: { position: index } }),
    ),
  );
  return { success: true, message: 'Đã cập nhật thứ tự.' };
}

export async function reorderModuleItemsAction(moduleId: string, orderedIds: string[]): Promise<ActionResult> {
  const mod = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!mod) return { success: false, error: 'Chương không tồn tại.' };

  const { error } = await assertCanManageCourse(mod.courseId);
  if (error) return { success: false, error };

  await Promise.all(
    orderedIds.map((id, index) =>
      prisma.moduleItem.update({ where: { id }, data: { position: index } }),
    ),
  );
  return { success: true, message: 'Đã cập nhật thứ tự.' };
}

// ── Module items ──────────────────────────────────────────────

export async function addModuleItemAction(
  moduleId: string,
  input: { title: string; type: 'LESSON' | 'EXTERNAL_URL'; lessonId?: string; externalUrl?: string },
): Promise<ActionResult<{ id: string }>> {
  const mod = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!mod) return { success: false, error: 'Chương không tồn tại.' };

  const { error } = await assertCanManageCourse(mod.courseId);
  if (error) return { success: false, error };

  const last = await prisma.moduleItem.findFirst({
    where: { moduleId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (last?.position ?? -1) + 1;

  const item = await prisma.moduleItem.create({
    data: {
      moduleId,
      type: input.type,
      position,
      title: input.title,
      lessonId: input.lessonId ?? null,
      externalUrl: input.externalUrl ?? null,
    },
  });

  return { success: true, message: 'Đã thêm bài học.', data: { id: item.id } };
}

export async function toggleModuleItemPublishAction(id: string): Promise<ActionResult> {
  const item = await prisma.moduleItem.findUnique({ where: { id }, include: { module: true } });
  if (!item) return { success: false, error: 'Không tìm thấy.' };

  const { error } = await assertCanManageCourse(item.module.courseId);
  if (error) return { success: false, error };

  await prisma.moduleItem.update({ where: { id }, data: { isPublished: !item.isPublished } });
  return { success: true, message: item.isPublished ? 'Đã ẩn bài.' : 'Đã xuất bản bài.' };
}

export async function deleteModuleItemAction(id: string): Promise<ActionResult> {
  const item = await prisma.moduleItem.findUnique({ where: { id }, include: { module: true } });
  if (!item) return { success: false, error: 'Không tìm thấy.' };

  const { error } = await assertCanManageCourse(item.module.courseId);
  if (error) return { success: false, error };

  await prisma.moduleItem.delete({ where: { id } });
  return { success: true, message: 'Đã xoá bài.' };
}

// ── List modules (for a course) ───────────────────────────────

export async function listModulesAction(courseId: string, publishedOnly = false) {
  return prisma.module.findMany({
    where: { courseId, ...(publishedOnly ? { isPublished: true } : {}) },
    orderBy: { position: 'asc' },
    include: {
      items: {
        where: publishedOnly ? { isPublished: true } : undefined,
        orderBy: { position: 'asc' },
        include: {
          lesson:       { select: { id: true, title: true, estimatedMinutes: true } },
          quiz:         { select: { id: true, title: true, status: true } } as any,
          codeExercise: { select: { id: true, title: true, language: true, status: true } },
        },
      },
    },
  });
}

export type ModuleWithItems = Awaited<ReturnType<typeof listModulesAction>>[number];

// ── Course-wide nav items (for prev/next across all activities) ─

export async function listCourseNavItemsAction(courseId: string, publishedOnly = false) {
  return prisma.moduleItem.findMany({
    where: {
      module: {
        courseId,
        ...(publishedOnly ? { isPublished: true } : {}),
      },
      type: { in: ['LESSON', 'ASSIGNMENT', 'QUIZ', 'CODE_EXERCISE'] },
      ...(publishedOnly ? { isPublished: true } : {}),
      // Với học sinh: chỉ hiện CODE_EXERCISE đã PUBLISHED (tránh click vào bị 404)
      ...(publishedOnly ? {
        OR: [
          { type: { not: 'CODE_EXERCISE' } },
          { type: 'CODE_EXERCISE', codeExercise: { status: 'PUBLISHED' } },
        ],
      } : {}),
    },
    orderBy: [
      { module: { position: 'asc' } },
      { position: 'asc' },
    ],
    select: {
      id: true,
      title: true,
      type: true,
      lessonId: true,
      assignmentId: true,
      quizId: true,
      codeExerciseId: true,
    },
  });
}

export type CourseNavItem = Awaited<ReturnType<typeof listCourseNavItemsAction>>[number];
