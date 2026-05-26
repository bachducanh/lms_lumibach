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
import {
  ActivityCompetencyQuerySchema,
  CreateCompetencyCategoryBodySchema,
  CreateCompetencyIndicatorBodySchema,
  SetActivityCompetenciesBodySchema,
  UpdateCompetencyCategoryBodySchema,
  UpdateCompetencyIndicatorBodySchema,
  UpsertCompetencyAssessmentBodySchema,
  type ActivityCompetencyQuery,
  type CreateCompetencyCategoryBody,
  type CreateCompetencyIndicatorBody,
  type SetActivityCompetenciesBody,
  type UpdateCompetencyCategoryBody,
  type UpdateCompetencyIndicatorBody,
  type UpsertCompetencyAssessmentBody,
} from '@lumibach/types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { zodBody, zodQuery } from '../../common/pipes/zod-query.pipe';
import type { AuthUser } from '../../common/auth/auth.types';
import { CompetenciesService } from './competencies.service';

@ApiTags('competencies')
@Controller({ version: '1' })
export class CompetenciesController {
  constructor(private readonly service: CompetenciesService) {}

  // ── Catalog ──────────────────────────────────────────────────

  @Get('courses/:courseId/competencies')
  @ApiOperation({ summary: 'Danh mục + chỉ báo năng lực của khoá học' })
  getCatalog(@CurrentUser() user: AuthUser, @Param('courseId') courseId: string) {
    return this.service.getCatalog(user, courseId);
  }

  @Get('courses/:courseId/competencies/stats')
  @ApiOperation({ summary: 'Thống kê năng lực toàn khoá' })
  getStats(@CurrentUser() user: AuthUser, @Param('courseId') courseId: string) {
    return this.service.getStats(user, courseId);
  }

  @Get('courses/:courseId/competencies/student/:studentId')
  @ApiOperation({ summary: 'Hồ sơ minh chứng năng lực của 1 học sinh' })
  getStudentEvidence(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Param('studentId') studentId: string
  ) {
    return this.service.getStudentEvidence(user, courseId, studentId);
  }

  @Post('courses/:courseId/competencies/categories')
  @ApiOperation({ summary: 'Tạo danh mục năng lực' })
  createCategory(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Body(zodBody(CreateCompetencyCategoryBodySchema)) body: CreateCompetencyCategoryBody
  ) {
    return this.service.createCategory(user, courseId, body);
  }

  @Patch('competencies/categories/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật danh mục năng lực' })
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateCompetencyCategoryBodySchema)) body: UpdateCompetencyCategoryBody
  ) {
    return this.service.updateCategory(user, id, body);
  }

  @Delete('competencies/categories/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá danh mục năng lực (xoá cả chỉ báo bên trong)' })
  deleteCategory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteCategory(user, id);
  }

  @Post('competencies/categories/:categoryId/indicators')
  @ApiOperation({ summary: 'Tạo chỉ báo năng lực' })
  createIndicator(
    @CurrentUser() user: AuthUser,
    @Param('categoryId') categoryId: string,
    @Body(zodBody(CreateCompetencyIndicatorBodySchema)) body: CreateCompetencyIndicatorBody
  ) {
    return this.service.createIndicator(user, categoryId, body);
  }

  @Patch('competencies/indicators/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật chỉ báo năng lực' })
  updateIndicator(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateCompetencyIndicatorBodySchema)) body: UpdateCompetencyIndicatorBody
  ) {
    return this.service.updateIndicator(user, id, body);
  }

  @Delete('competencies/indicators/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá chỉ báo năng lực' })
  deleteIndicator(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteIndicator(user, id);
  }

  // ── Activity links + assessments ─────────────────────────────

  @Get('competencies/activity')
  @ApiOperation({ summary: 'Chỉ báo đã gán + đánh giá của 1 hoạt động' })
  getActivityState(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(ActivityCompetencyQuerySchema)) query: ActivityCompetencyQuery
  ) {
    return this.service.getActivityState(user, query.activityType, query.activityId);
  }

  @Put('competencies/activity')
  @HttpCode(200)
  @ApiOperation({ summary: 'Gán danh sách chỉ báo cho 1 hoạt động' })
  setActivityCompetencies(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(SetActivityCompetenciesBodySchema)) body: SetActivityCompetenciesBody
  ) {
    return this.service.setActivityCompetencies(user, body);
  }

  @Put('competencies/assessment')
  @HttpCode(200)
  @ApiOperation({ summary: 'Chấm năng lực (loại minh chứng + mức độ) cho 1 học sinh' })
  upsertAssessment(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(UpsertCompetencyAssessmentBodySchema)) body: UpsertCompetencyAssessmentBody
  ) {
    return this.service.upsertAssessment(user, body);
  }

  @Delete('competencies/assessment/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá đánh giá năng lực' })
  deleteAssessment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteAssessment(user, id);
  }
}
