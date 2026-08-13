import { Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/decorators/public.decorator';
import { RoomJobsService } from './room-jobs.service';

/**
 * Các việc chạy theo lịch của module Phòng chức năng.
 *
 * `@Public()` vì cron không có phiên đăng nhập; chặn bằng `x-cron-secret` thay
 * thế — cùng cách `courses/purge-expired` đang làm. Thiếu `CRON_SECRET` trong
 * env thì mọi lời gọi đều bị từ chối, không có nhánh "bỏ qua kiểm tra".
 */
@ApiTags('room-jobs')
@Controller({ path: 'room-jobs', version: '1' })
export class RoomJobsController {
  constructor(private readonly service: RoomJobsService) {}

  @Public()
  @Post('no-show')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đánh dấu đơn quá giờ mà không nhận (cron, cần x-cron-secret)' })
  noShow(@Headers('x-cron-secret') secret?: string) {
    this.assertCronSecret(secret);
    return this.service.markNoShow();
  }

  @Public()
  @Post('purge-photos')
  @HttpCode(200)
  @ApiOperation({ summary: 'Dọn ảnh bàn giao quá hạn lưu giữ (cron, cần x-cron-secret)' })
  purgePhotos(@Headers('x-cron-secret') secret?: string) {
    this.assertCronSecret(secret);
    return this.service.purgeOldPhotos();
  }

  private assertCronSecret(secret?: string): void {
    const expected = process.env.CRON_SECRET;
    if (!expected || secret !== expected) throw new UnauthorizedException('Sai cron secret');
  }
}
