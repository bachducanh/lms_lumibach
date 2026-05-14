import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import type { AuthUser } from '../../common/auth/auth.types';
import { AssignmentsService } from './assignments.service';

@ApiTags('assignments')
@Controller({ path: 'assignments', version: '1' })
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách bài tập theo module (grouped)' })
  list(@CurrentUser() user: AuthUser, @Query('courseId') courseId: string) {
    return this.service.listByModule(user, courseId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết bài tập' })
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo bài tập (TEACHER+)' })
  create(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.service.create(user, body as Parameters<AssignmentsService['create']>[1]);
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật bài tập' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.service.update(user, id, body as Parameters<AssignmentsService['update']>[2]);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá bài tập (soft delete)' })
  delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.delete(user, id);
  }

  // ── Submissions ─────────────────────────────────────────────

  @Get(':id/my-submissions')
  @ApiOperation({ summary: 'Danh sách bài nộp của mình' })
  getMySubmissions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getMySubmissions(user, id);
  }

  @Get(':id/submissions')
  @ApiOperation({ summary: 'Tất cả bài nộp (TA+)' })
  getAllSubmissions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getAllSubmissions(user, id);
  }

  @Post(':id/submissions')
  @ApiOperation({ summary: 'Nộp bài' })
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { content: string; asDraft?: boolean }
  ) {
    return this.service.submitAssignment(user, id, body);
  }

  @Patch('submissions/:subId/grade')
  @HttpCode(200)
  @ApiOperation({ summary: 'Chấm điểm bài nộp (TA+)' })
  grade(
    @CurrentUser() user: AuthUser,
    @Param('subId') subId: string,
    @Body() body: { score: number; feedback: string }
  ) {
    return this.service.gradeSubmission(user, subId, body);
  }

  @Delete('submissions/:subId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá bài nộp (TA+)' })
  deleteSubmission(@CurrentUser() user: AuthUser, @Param('subId') subId: string) {
    return this.service.deleteSubmission(user, subId);
  }
}
