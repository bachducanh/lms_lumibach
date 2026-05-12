'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import type { UserRole } from '@lumibach/db';
import type { ActionResult } from './auth';

export type AttachmentDTO = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: Date;
};

export async function getLessonAttachmentsAction(lessonId: string): Promise<AttachmentDTO[]> {
  return prisma.lessonAttachment.findMany({
    where: { lessonId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, url: true, mimeType: true, size: true, createdAt: true },
  });
}

export async function deleteLessonAttachmentAction(attachmentId: string): Promise<ActionResult> {
  const session = await auth();
  const role = session?.user?.role as UserRole;
  if (!hasMinRole(role, 'TEACHER')) return { success: false, error: 'Không có quyền.' };

  const attachment = await prisma.lessonAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) return { success: false, error: 'Không tìm thấy file.' };

  // Delete from DB only — MinIO deletion is done via the API route which handles the object name
  await prisma.lessonAttachment.delete({ where: { id: attachmentId } });

  return { success: true, message: 'Đã xoá file.' };
}
