import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import type { AttachmentDTO } from '@lumibach/types';
import type { AuthUser } from '../../common/auth/auth.types';

const ROLE_ORDER = ['STUDENT', 'TA', 'TEACHER', 'ADMIN', 'SUPERADMIN'] as const;
type Role = (typeof ROLE_ORDER)[number];

function hasMinRole(userRole: string, minRole: Role): boolean {
  return ROLE_ORDER.indexOf(userRole as Role) >= ROLE_ORDER.indexOf(minRole);
}

@Injectable()
export class AttachmentsService {
  constructor(private readonly prisma: PrismaClient) {}

  async getLessonAttachments(_actor: AuthUser, lessonId: string): Promise<AttachmentDTO[]> {
    const attachments = await this.prisma.lessonAttachment.findMany({
      where: { lessonId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, url: true, mimeType: true, size: true, createdAt: true },
    });
    return attachments.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }));
  }

  async deleteLessonAttachment(actor: AuthUser, attachmentId: string): Promise<void> {
    if (!hasMinRole(actor.role, 'TEACHER')) throw new ForbiddenException('Không có quyền');

    const attachment = await this.prisma.lessonAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundException('Không tìm thấy file');

    await this.prisma.lessonAttachment.delete({ where: { id: attachmentId } });
  }
}
