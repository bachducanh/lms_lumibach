import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import type { AuthUser } from '../../common/auth/auth.types';
import { AttemptsService } from './attempts.service';

@ApiTags('attempts')
@Controller({ path: 'attempts', version: '1' })
export class AttemptsController {
  constructor(private readonly service: AttemptsService) {}

  @Post()
  @ApiOperation({ summary: 'Bắt đầu / tiếp tục làm quiz' })
  start(@CurrentUser() user: AuthUser, @Body() body: { quizId: string }) {
    return this.service.start(user, body.quizId);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Danh sách lần làm của mình' })
  listMine(@CurrentUser() user: AuthUser, @Query('quizId') quizId: string) {
    return this.service.listMine(user, quizId);
  }

  @Get('all')
  @ApiOperation({ summary: 'Tất cả lần làm (TA+)' })
  listAll(@CurrentUser() user: AuthUser, @Query('quizId') quizId: string) {
    return this.service.listAll(user, quizId);
  }

  @Get('detailed')
  @ApiOperation({ summary: 'Chi tiết tất cả lần làm kèm điểm từng câu (TA+)' })
  listDetailed(@CurrentUser() user: AuthUser, @Query('quizId') quizId: string) {
    return this.service.listDetailed(user, quizId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết một lần làm' })
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getById(user, id);
  }

  @Post(':id/answers')
  @HttpCode(200)
  @ApiOperation({ summary: 'Lưu câu trả lời' })
  saveAnswer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: {
      questionId: string;
      type: string;
      selectedOptionIds?: string[];
      booleanAnswer?: boolean;
      textAnswer?: string;
    }
  ) {
    return this.service.saveAnswer(user, id, body);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Nộp bài' })
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.submit(user, id);
  }

  @Delete()
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá nhiều lần làm (TEACHER+)' })
  deleteMany(@CurrentUser() user: AuthUser, @Body() body: { ids: string[] }) {
    return this.service.deleteMany(user, body.ids);
  }

  @Patch('answers/:answerId/grade')
  @HttpCode(200)
  @ApiOperation({ summary: 'Chấm điểm câu tự luận (TA+)' })
  gradeEssay(
    @CurrentUser() user: AuthUser,
    @Param('answerId') answerId: string,
    @Body() body: { score: number; feedback?: string | null }
  ) {
    return this.service.gradeEssay(user, answerId, body);
  }
}
