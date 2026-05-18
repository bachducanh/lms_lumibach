import { Controller, Delete, Get, HttpCode, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AttachmentsQuerySchema, type AttachmentsQuery } from '@lumibach/types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { zodQuery } from '../../common/pipes/zod-query.pipe';
import type { AuthUser } from '../../common/auth/auth.types';
import { AttachmentsService } from './attachments.service';

@ApiTags('attachments')
@Controller({ path: 'attachments', version: '1' })
export class AttachmentsController {
  constructor(private readonly service: AttachmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách file đính kèm của bài giảng' })
  getLessonAttachments(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(AttachmentsQuerySchema)) query: AttachmentsQuery
  ) {
    return this.service.getLessonAttachments(user, query.lessonId);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá file đính kèm (TEACHER+)' })
  deleteAttachment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteLessonAttachment(user, id);
  }
}
