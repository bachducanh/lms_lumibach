import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  CreateLessonBodySchema,
  UpdateLessonBodySchema,
  MarkCompleteBodySchema,
  type CreateLessonBody,
  type UpdateLessonBody,
  type MarkCompleteBody,
} from '@lumibach/types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { zodBody } from '../../common/pipes/zod-query.pipe';
import type { AuthUser } from '../../common/auth/auth.types';
import { LessonsService } from './lessons.service';

@ApiTags('lessons')
@Controller({ path: 'lessons', version: '1' })
export class LessonsController {
  constructor(private readonly service: LessonsService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo bài giảng (TEACHER+)' })
  createLesson(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(CreateLessonBodySchema)) body: CreateLessonBody
  ) {
    return this.service.createLesson(user, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Nội dung bài giảng' })
  getLesson(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getLesson(user, id);
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật bài giảng (TEACHER+)' })
  updateLesson(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateLessonBodySchema)) body: UpdateLessonBody
  ) {
    return this.service.updateLesson(user, id, body);
  }

  @Post('completions')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đánh dấu hoàn thành bài học' })
  markComplete(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(MarkCompleteBodySchema)) body: MarkCompleteBody
  ) {
    return this.service.markComplete(user, body);
  }

  @Delete('completions/:moduleItemId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bỏ đánh dấu hoàn thành' })
  unmarkComplete(@CurrentUser() user: AuthUser, @Param('moduleItemId') moduleItemId: string) {
    return this.service.unmarkComplete(user, moduleItemId);
  }
}
