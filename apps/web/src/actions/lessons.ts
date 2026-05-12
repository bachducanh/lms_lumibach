'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import type { UserRole } from '@lumibach/db';
import type { ActionResult } from './auth';

const lessonSchema = z.object({
  title: z.string().min(1, 'Tiêu đề không được trống'),
  content: z.string().default(''),
  estimatedMinutes: z.number().int().positive().optional(),
});

export type LessonFormValues = z.infer<typeof lessonSchema>;

export async function createLessonAction(
  courseId: string,
  moduleId: string,
  input: LessonFormValues
): Promise<ActionResult<{ lessonId: string; itemId: string }>> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const parsed = lessonSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Dữ liệu không hợp lệ.' };

  const mod = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!mod || mod.courseId !== courseId) return { success: false, error: 'Chương không hợp lệ.' };

  const { title, content, estimatedMinutes } = parsed.data;

  const lesson = await prisma.lesson.create({
    data: {
      title,
      content,
      estimatedMinutes: estimatedMinutes ?? null,
      createdBy: session!.user!.id,
    },
  });

  // Tự động tạo ModuleItem link tới lesson này
  const last = await prisma.moduleItem.findFirst({
    where: { moduleId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (last?.position ?? -1) + 1;

  const item = await prisma.moduleItem.create({
    data: { moduleId, type: 'LESSON', position, title, lessonId: lesson.id },
  });

  return {
    success: true,
    message: 'Đã tạo bài giảng.',
    data: { lessonId: lesson.id, itemId: item.id },
  };
}

export async function updateLessonAction(
  id: string,
  input: LessonFormValues
): Promise<ActionResult> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const parsed = lessonSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Dữ liệu không hợp lệ.' };

  const existing = await prisma.lesson.findUnique({ where: { id } });
  if (!existing) return { success: false, error: 'Bài giảng không tồn tại.' };

  const { title, content, estimatedMinutes } = parsed.data;

  await prisma.$transaction([
    prisma.lesson.update({
      where: { id },
      data: { title, content, estimatedMinutes: estimatedMinutes ?? null },
    }),
    // Sync title vào ModuleItem
    prisma.moduleItem.updateMany({
      where: { lessonId: id },
      data: { title },
    }),
  ]);

  return { success: true, message: 'Đã cập nhật bài giảng.' };
}

export async function getLessonAction(id: string) {
  return prisma.lesson.findUnique({
    where: { id },
    include: {
      moduleItems: {
        include: { module: { select: { id: true, name: true, courseId: true } } },
      },
      attachments: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, url: true, mimeType: true, size: true, createdAt: true },
      },
    },
  });
}

export async function markLessonCompleteAction(moduleItemId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };

  const item = await prisma.moduleItem.findUnique({
    where: { id: moduleItemId },
    include: { module: { select: { courseId: true } } },
  });
  if (!item) return { success: false, error: 'Bài học không tồn tại.' };

  const courseId = item.module.courseId;

  await prisma.moduleItemCompletion.upsert({
    where: { userId_moduleItemId: { userId: session.user.id, moduleItemId } },
    create: { userId: session.user.id, moduleItemId },
    update: { completedAt: new Date() },
  });

  // Tính lại tiến độ enrollment
  const [totalItems, completedItems] = await Promise.all([
    prisma.moduleItem.count({ where: { module: { courseId }, isPublished: true } }),
    prisma.moduleItemCompletion.count({
      where: { userId: session.user.id, moduleItem: { module: { courseId }, isPublished: true } },
    }),
  ]);

  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  await prisma.enrollment.updateMany({
    where: { userId: session.user.id, courseId },
    data: { progress, lastAccessAt: new Date() },
  });

  return { success: true, message: 'Đã đánh dấu hoàn thành.' };
}

export async function unmarkLessonCompleteAction(moduleItemId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };

  const item = await prisma.moduleItem.findUnique({
    where: { id: moduleItemId },
    include: { module: { select: { courseId: true } } },
  });
  if (!item) return { success: false, error: 'Bài học không tồn tại.' };

  const courseId = item.module.courseId;

  await prisma.moduleItemCompletion.deleteMany({
    where: { userId: session.user.id, moduleItemId },
  });

  const [totalItems, completedItems] = await Promise.all([
    prisma.moduleItem.count({ where: { module: { courseId }, isPublished: true } }),
    prisma.moduleItemCompletion.count({
      where: { userId: session.user.id, moduleItem: { module: { courseId }, isPublished: true } },
    }),
  ]);

  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  await prisma.enrollment.updateMany({
    where: { userId: session.user.id, courseId },
    data: { progress, lastAccessAt: new Date() },
  });

  return { success: true, message: 'Đã bỏ đánh dấu hoàn thành.' };
}
