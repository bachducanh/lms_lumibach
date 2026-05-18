import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import type { AuthUser } from '../../common/auth/auth.types';
import { RubricsService } from './rubrics.service';

@ApiTags('rubrics')
@Controller({ path: 'rubrics', version: '1' })
export class RubricsController {
  constructor(private readonly service: RubricsService) {}

  // ── Assignment rubric ─────────────────────────────────────────

  @Get('assignment/:id')
  @ApiOperation({ summary: 'Lấy rubric của bài tập' })
  getAssignmentRubric(@Param('id') id: string) {
    return this.service.getAssignmentRubric(id);
  }

  @Post('assignment/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Lưu rubric của bài tập' })
  saveAssignmentRubric(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { criteria: Parameters<RubricsService['saveAssignmentRubric']>[2] }
  ) {
    return this.service.saveAssignmentRubric(user, id, body.criteria);
  }

  @Delete('assignment/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá rubric của bài tập' })
  deleteAssignmentRubric(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteAssignmentRubric(user, id);
  }

  // ── Code exercise rubric ──────────────────────────────────────

  @Get('code-exercise/:id')
  @ApiOperation({ summary: 'Lấy rubric của bài tập code' })
  getCodeExerciseRubric(@Param('id') id: string) {
    return this.service.getCodeExerciseRubric(id);
  }

  @Post('code-exercise/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Lưu rubric của bài tập code' })
  saveCodeExerciseRubric(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { criteria: Parameters<RubricsService['saveCodeExerciseRubric']>[2] }
  ) {
    return this.service.saveCodeExerciseRubric(user, id, body.criteria);
  }

  @Delete('code-exercise/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá rubric của bài tập code' })
  deleteCodeExerciseRubric(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteCodeExerciseRubric(user, id);
  }

  // ── Grading ───────────────────────────────────────────────────

  @Post('grade/submission/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Chấm điểm bài nộp với rubric' })
  gradeSubmission(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { selections: { criterionId: string; levelId: string }[] }
  ) {
    return this.service.gradeSubmission(user, id, body.selections);
  }

  @Get('grades/submission/:id')
  @ApiOperation({ summary: 'Lấy điểm rubric của bài nộp' })
  getSubmissionGrades(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getSubmissionRubricGrades(user, id);
  }

  @Post('grade/code-submission/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Chấm điểm bài nộp code với rubric' })
  gradeCodeSubmission(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { selections: { criterionId: string; levelId: string }[]; maxScore?: number }
  ) {
    return this.service.gradeCodeSubmission(user, id, body.selections, body.maxScore);
  }

  @Get('grades/code-submission/:id')
  @ApiOperation({ summary: 'Lấy điểm rubric của bài nộp code' })
  getCodeSubmissionGrades(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getCodeSubmissionRubricGrades(user, id);
  }
}
