import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  ForumTopicsQuerySchema,
  CreateTopicBodySchema,
  UpdateTopicBodySchema,
  CreatePostBodySchema,
  MarkAnswerBodySchema,
  type ForumTopicsQuery,
  type CreateTopicBody,
  type UpdateTopicBody,
  type CreatePostBody,
  type MarkAnswerBody,
} from '@lumibach/types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { zodBody, zodQuery } from '../../common/pipes/zod-query.pipe';
import type { AuthUser } from '../../common/auth/auth.types';
import { ForumService } from './forum.service';

@ApiTags('forum')
@Controller({ path: 'forum', version: '1' })
export class ForumController {
  constructor(private readonly service: ForumService) {}

  @Get('topics')
  @ApiOperation({ summary: 'Danh sách topic của một course (enrolled / TEACHER+)' })
  listTopics(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(ForumTopicsQuerySchema)) query: ForumTopicsQuery
  ) {
    return this.service.listTopics(user, query.courseId);
  }

  @Get('topics/:id')
  @ApiOperation({ summary: 'Chi tiết topic với posts và replies' })
  getTopic(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getTopic(user, id);
  }

  @Post('topics')
  @ApiOperation({ summary: 'Tạo topic mới' })
  createTopic(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(CreateTopicBodySchema)) body: CreateTopicBody
  ) {
    return this.service.createTopic(user, body);
  }

  @Patch('topics/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật pin/lock topic (TEACHER+)' })
  updateTopic(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateTopicBodySchema)) body: UpdateTopicBody
  ) {
    return this.service.updateTopic(user, id, body);
  }

  @Delete('topics/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá topic (tác giả hoặc TEACHER+)' })
  deleteTopic(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteTopic(user, id);
  }

  @Post('posts')
  @ApiOperation({ summary: 'Tạo post/reply trong topic' })
  createPost(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(CreatePostBodySchema)) body: CreatePostBody
  ) {
    return this.service.createPost(user, body);
  }

  @Patch('posts/:id/answer')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đánh dấu / bỏ đánh dấu câu trả lời được chấp nhận' })
  markAnswer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(MarkAnswerBodySchema)) body: MarkAnswerBody
  ) {
    return this.service.markAnswer(user, id, body);
  }

  @Delete('posts/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá post (tác giả hoặc TEACHER+)' })
  deletePost(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deletePost(user, id);
  }
}
