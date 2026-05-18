import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import type { AuthUser } from '../../common/auth/auth.types';
import { QuizzesService } from './quizzes.service';

@ApiTags('quizzes')
@Controller({ path: 'quizzes', version: '1' })
export class QuizzesController {
  constructor(private readonly service: QuizzesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách quiz theo module' })
  list(@CurrentUser() user: AuthUser, @Query('courseId') courseId: string) {
    return this.service.listByModule(user, courseId);
  }

  @Get('banks')
  @ApiOperation({ summary: 'Ngân hàng câu hỏi cho quiz builder' })
  listBanks(@CurrentUser() user: AuthUser, @Query('courseId') courseId: string) {
    return this.service.listBanks(user, courseId);
  }

  @Get('quiz-questions/:qqId')
  @ApiOperation({ summary: 'Placeholder for quiz question' })
  getQuizQuestion(@Param('qqId') _qqId: string) {
    return {};
  }

  @Patch('quiz-questions/:qqId/points')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật điểm câu hỏi trong quiz' })
  updatePoints(
    @CurrentUser() user: AuthUser,
    @Param('qqId') qqId: string,
    @Body() body: { points: number }
  ) {
    return this.service.updateQuizQuestionPoints(user, qqId, body.points);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết quiz' })
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Xem trước quiz (TA+)' })
  getPreview(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getPreview(user, id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo quiz' })
  create(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.service.create(user, body as Parameters<QuizzesService['create']>[1]);
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật quiz' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.service.update(user, id, body as Parameters<QuizzesService['update']>[2]);
  }

  @Patch(':id/status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Thay đổi trạng thái quiz' })
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { publish: boolean }
  ) {
    return this.service.setStatus(user, id, body.publish);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá quiz' })
  delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.delete(user, id);
  }

  // ── Questions management ─────────────────────────────────────

  @Post(':id/questions')
  @ApiOperation({ summary: 'Thêm câu hỏi vào quiz' })
  addQuestion(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: {
      questionId?: string;
      questionIds?: string[];
      random?: boolean;
      count?: number;
      fromCategoryId?: string;
    }
  ) {
    if (body.random) {
      return this.service.addRandomQuestions(user, id, body.count ?? 5, body.fromCategoryId);
    }
    if (body.questionIds) {
      return this.service.addMultipleQuestions(user, id, body.questionIds);
    }
    return this.service.addQuestion(user, id, body.questionId!);
  }

  @Delete(':id/questions/:questionId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá câu hỏi khỏi quiz' })
  removeQuestion(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('questionId') questionId: string
  ) {
    return this.service.removeQuestion(user, id, questionId);
  }

  @Patch(':id/questions/reorder')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sắp xếp lại thứ tự câu hỏi' })
  reorderQuestions(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { orderedIds: string[] }
  ) {
    return this.service.reorderQuestions(user, id, body.orderedIds);
  }
}
