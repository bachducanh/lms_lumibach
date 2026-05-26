import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import type { AuthUser } from '../../common/auth/auth.types';
import { PracticeTestsService } from './practice-tests.service';

@ApiTags('practice-tests')
@Controller({ path: 'practice-tests', version: '1' })
export class PracticeTestsController {
  constructor(private readonly service: PracticeTestsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách đề luyện tập theo module' })
  list(@CurrentUser() user: AuthUser, @Query('courseId') courseId: string) {
    return this.service.listByModule(user, courseId);
  }

  @Get('attempts/:attemptId')
  @ApiOperation({ summary: 'Chi tiết một bài làm đề luyện tập' })
  getAttempt(@CurrentUser() user: AuthUser, @Param('attemptId') attemptId: string) {
    return this.service.getAttempt(user, attemptId);
  }

  @Get(':id/my-attempts')
  @ApiOperation({ summary: 'Danh sách lần làm của mình' })
  listMine(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.listMine(user, id);
  }

  @Get(':id/attempts')
  @ApiOperation({ summary: 'Tất cả lần làm đề luyện tập (TA+)' })
  listAll(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.listAll(user, id);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Xem thử đề luyện tập (TA+)' })
  getPreview(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getPreview(user, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đề luyện tập' })
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getById(user, id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo đề luyện tập PDF' })
  create(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.service.create(user, body as Parameters<PracticeTestsService['create']>[1]);
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật đề luyện tập PDF' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.service.update(user, id, body as Parameters<PracticeTestsService['update']>[2]);
  }

  @Patch(':id/status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng / hủy đăng đề luyện tập' })
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { publish: boolean }
  ) {
    return this.service.setStatus(user, id, body.publish);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá đề luyện tập' })
  delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.delete(user, id);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Nộp và chấm điểm đề luyện tập' })
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { answers?: Parameters<PracticeTestsService['submit']>[2]['answers'] }
  ) {
    return this.service.submit(user, id, body);
  }
}
