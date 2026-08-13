import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  ForumTopicsQuerySchema,
  CreateTopicBodySchema,
  UpdateTopicBodySchema,
  CreatePostBodySchema,
  CreateForumBodySchema,
  MarkAnswerBodySchema,
  UpdateForumBodySchema,
  UpdatePostBodySchema,
  type ForumTopicsQuery,
  type CreateTopicBody,
  type UpdateTopicBody,
  type CreatePostBody,
  type CreateForumBody,
  type MarkAnswerBody,
  type UpdateForumBody,
  type UpdatePostBody,
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
    return this.service.listTopics(user, query.courseId, query.forumId);
  }

  // ── Diễn đàn (hoạt động trong chương) ────────────────────────

  @Get('courses/:courseId')
  @ApiOperation({ summary: 'Diễn đàn của khoá học, nhóm theo chương' })
  listForums(@CurrentUser() user: AuthUser, @Param('courseId') courseId: string) {
    return this.service.listForums(user, courseId);
  }

  @Get('forums/:id')
  @ApiOperation({ summary: 'Chi tiết một diễn đàn' })
  getForum(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getForum(user, id);
  }

  @Post('forums')
  @ApiOperation({ summary: 'Tạo diễn đàn trong một chương (TEACHER+)' })
  createForum(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(CreateForumBodySchema)) body: CreateForumBody
  ) {
    return this.service.createForum(user, body);
  }

  @Patch('forums/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sửa tên / mô tả diễn đàn (TEACHER+)' })
  updateForum(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateForumBodySchema)) body: UpdateForumBody
  ) {
    return this.service.updateForum(user, id, body);
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

  @Patch('posts/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sửa nội dung bài viết / trả lời (tác giả hoặc TEACHER+)' })
  updatePost(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdatePostBodySchema)) body: UpdatePostBody
  ) {
    return this.service.updatePost(user, id, body);
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
