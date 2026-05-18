import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import type { AuthUser } from '../../common/auth/auth.types';
import { CodeExercisesService } from './code-exercises.service';

@ApiTags('code-exercises')
@Controller({ path: 'code-exercises', version: '1' })
export class CodeExercisesController {
  constructor(private readonly service: CodeExercisesService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo bài tập code (TA+)' })
  create(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.service.create(user, body as Parameters<CodeExercisesService['create']>[1]);
  }

  // MUST be defined before `:id` routes to avoid route conflict
  @Get('by-module')
  @ApiOperation({ summary: 'Danh sách bài tập theo module' })
  listByModule(@CurrentUser() user: AuthUser, @Query('courseId') courseId: string) {
    return this.service.listByModule(user, courseId);
  }

  // `submissions/:subId` has 2 path segments — no conflict with `:id` (1 segment)
  @Get('submissions/:subId')
  @ApiOperation({ summary: 'Chi tiết bài nộp' })
  getSubmission(@CurrentUser() user: AuthUser, @Param('subId') subId: string) {
    return this.service.getSubmission(user, subId);
  }

  @Patch('submissions/:subId/grade')
  @HttpCode(200)
  @ApiOperation({ summary: 'Chấm điểm bài nộp (TA+)' })
  grade(
    @CurrentUser() user: AuthUser,
    @Param('subId') subId: string,
    @Body() body: { score: number; maxScore: number; feedback?: string }
  ) {
    return this.service.grade(user, subId, body);
  }

  @Delete('submissions/:subId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá bài nộp (TA+)' })
  deleteSubmission(@CurrentUser() user: AuthUser, @Param('subId') subId: string) {
    return this.service.deleteSubmission(user, subId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết bài tập (kèm test cases)' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật cấu hình bài tập (TA+)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.service.update(user, id, body);
  }

  @Put(':id/test-cases')
  @HttpCode(200)
  @ApiOperation({ summary: 'Lưu toàn bộ test cases (full replace, TA+)' })
  saveTestCases(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { testCases: Parameters<CodeExercisesService['saveTestCases']>[2] }
  ) {
    return this.service.saveTestCases(user, id, body.testCases);
  }

  @Post(':id/run')
  @HttpCode(200)
  @ApiOperation({ summary: 'Chạy code (không lưu)' })
  run(@Param('id') id: string, @Body() body: { code: string; language: string; stdin?: string }) {
    return this.service.run(id, body);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Nộp bài' })
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { code: string; language: string }
  ) {
    return this.service.submit(user, id, body);
  }

  @Get(':id/my-submissions')
  @ApiOperation({ summary: 'Danh sách bài nộp của mình' })
  mySubmissions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.mySubmissions(user, id);
  }

  @Get(':id/submissions')
  @ApiOperation({ summary: 'Tất cả bài nộp (TA+)' })
  allSubmissions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.allSubmissions(user, id);
  }
}
