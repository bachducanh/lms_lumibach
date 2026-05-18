import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  NotificationListQuerySchema,
  NotificationPrefsUpdateSchema,
  type NotificationListQuery,
  type NotificationPrefsUpdate,
} from '@lumibach/types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { zodBody, zodQuery } from '../../common/pipes/zod-query.pipe';
import type { AuthUser } from '../../common/auth/auth.types';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications của user hiện tại' })
  list(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(NotificationListQuerySchema)) query: NotificationListQuery
  ) {
    return this.service.list(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Số notification chưa đọc của user hiện tại' })
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.service.unreadCount(user.id);
  }

  @Post(':id/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark 1 notification (own) là đã đọc' })
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.markRead(user.id, id);
  }

  @Post('read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark tất cả notifications của user là đã đọc' })
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.service.markAllRead(user.id);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Lấy notification preferences (default nếu chưa set)' })
  getPrefs(@CurrentUser() user: AuthUser) {
    return this.service.getPrefs(user.id);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Upsert notification preferences (partial OK)' })
  savePrefs(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(NotificationPrefsUpdateSchema)) body: NotificationPrefsUpdate
  ) {
    return this.service.savePrefs(user.id, body);
  }
}
