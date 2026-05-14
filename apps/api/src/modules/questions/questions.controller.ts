import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import type { AuthUser } from '../../common/auth/auth.types';
import { QuestionsService } from './questions.service';

@ApiTags('questions')
@Controller({ path: 'questions', version: '1' })
export class QuestionsController {
  constructor(private readonly service: QuestionsService) {}

  // ── Categories ────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'Danh sách danh mục câu hỏi' })
  listCategories(@CurrentUser() user: AuthUser, @Query('courseId') courseId: string) {
    return this.service.listCategories(user, courseId);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Tạo danh mục câu hỏi' })
  createCategory(@CurrentUser() user: AuthUser, @Body() body: { courseId: string; name: string }) {
    return this.service.createCategory(user, body.courseId, body.name);
  }

  @Patch('categories/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật danh mục câu hỏi' })
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { name: string }
  ) {
    return this.service.updateCategory(user, id, body.name);
  }

  @Delete('categories/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá danh mục câu hỏi' })
  deleteCategory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteCategory(user, id);
  }

  // ── Questions ─────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Danh sách câu hỏi theo danh mục' })
  listByCategory(@CurrentUser() user: AuthUser, @Query('courseId') courseId: string) {
    return this.service.listByCategory(user, courseId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết câu hỏi' })
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo câu hỏi' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { courseId: string } & Record<string, unknown>
  ) {
    const { courseId, ...data } = body;
    return this.service.create(user, courseId, data as Parameters<QuestionsService['create']>[2]);
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật câu hỏi' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.service.update(user, id, body as Parameters<QuestionsService['update']>[2]);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá câu hỏi (soft delete)' })
  delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.delete(user, id);
  }

  // ── Judge0 ────────────────────────────────────────────────────

  @Post(':id/run-solution')
  @HttpCode(200)
  @ApiOperation({ summary: 'Chạy code đáp án để sinh expected output (TA+)' })
  runSolution(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: {
      code: string;
      language: 'PYTHON3' | 'CPP17';
      input: string;
      timeLimitSec: number;
      memoryLimitKB: number;
    }
  ) {
    return this.service.runSolutionCode(
      user,
      id,
      body.code,
      body.language,
      body.input,
      body.timeLimitSec,
      body.memoryLimitKB
    );
  }

  @Post(':id/check-code')
  @HttpCode(200)
  @ApiOperation({ summary: 'Kiểm tra code sinh viên với test case' })
  checkCode(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { code: string }
  ) {
    return this.service.checkQuizCode(user, id, body.code);
  }
}
