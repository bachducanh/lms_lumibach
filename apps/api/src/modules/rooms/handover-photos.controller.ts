import { Controller, ForbiddenException, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaClient } from '@lumibach/db';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import type { AuthUser } from '../../common/auth/auth.types';
import { StorageService } from '../../common/storage/storage.service';

@ApiTags('handover-photos')
@Roles('TEACHER', 'TA')
@Controller({ path: 'handover-photos', version: '1' })
export class HandoverPhotosController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService
  ) {}

  @Get(':id/file')
  @ApiOperation({ summary: 'Xem ảnh bàn giao, có kiểm quyền chủ đơn/admin' })
  async file(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const photo = await this.prisma.handoverPhoto.findUnique({
      where: { id },
      include: {
        handover: {
          select: {
            roomBooking: { select: { userId: true } },
            equipmentBooking: { select: { userId: true } },
          },
        },
      },
    });

    if (!photo) throw new NotFoundException('Không tìm thấy ảnh bàn giao.');

    const ownerId = photo.handover.roomBooking?.userId ?? photo.handover.equipmentBooking?.userId;
    if (user.role !== 'ADMIN' && ownerId !== user.id) {
      throw new ForbiddenException('Bạn không xem được ảnh bàn giao của đơn này.');
    }

    const stream = await this.storage.getObject(photo.bucket, photo.objectName);
    res.setHeader('Content-Type', photo.mime);
    res.setHeader('Content-Length', String(photo.size));
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('Content-Disposition', `inline; filename="${photo.id}.${extension(photo.mime)}"`);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }
}

function extension(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}
