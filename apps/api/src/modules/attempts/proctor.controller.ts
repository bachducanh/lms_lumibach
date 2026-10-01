import { Body, Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import type { AuthUser } from '../../common/auth/auth.types';
import { ProctorService } from './proctor.service';

@ApiTags('attempts')
@Controller({ path: 'attempts', version: '1' })
export class ProctorController {
  constructor(private readonly service: ProctorService) {}

  @Post(':id/proctor/events')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ghi sự kiện giám sát rời bài (học sinh)' })
  recordEvent(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { type?: string; clientAt?: string | null; meta?: unknown }
  ) {
    return this.service.recordEvent(user, id, body ?? {});
  }

  @Post(':id/proctor/events/:eventId/end')
  @HttpCode(200)
  @ApiOperation({ summary: 'Kết thúc một lượt rời bài khi học sinh quay lại' })
  endEvent(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Body() body: { hidden?: boolean; captureFailures?: number }
  ) {
    return this.service.endEvent(user, id, eventId, body ?? {});
  }

  @Get(':id/proctor')
  @ApiOperation({ summary: 'Nhật ký giám sát rời bài của một lượt làm (người chấm)' })
  report(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.report(user, id);
  }

  @Get('proctor-snapshots/:snapshotId/file')
  @ApiOperation({ summary: 'Xem ảnh chụp màn hình minh chứng, có kiểm quyền người chấm' })
  async snapshotFile(
    @CurrentUser() user: AuthUser,
    @Param('snapshotId') snapshotId: string,
    @Res() res: Response
  ) {
    const { stream, mime, size, id } = await this.service.snapshotFile(user, snapshotId);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', String(size));
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Disposition', `inline; filename="giam-sat-${id}.jpg"`);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }
}
