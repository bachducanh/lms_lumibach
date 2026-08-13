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
  CreateCompetencyComponentBodySchema,
  CreateCompetencyIndicatorBodySchema,
  CreateCompetencyPeriodBodySchema,
  ImportCompetenciesBodySchema,
  SetActivityCompetenciesBodySchema,
  UpdateCompetencyCategoryBodySchema,
  UpdateCompetencyComponentBodySchema,
  UpdateCompetencyIndicatorBodySchema,
  UpdateCompetencyPeriodBodySchema,
  UpsertActivityCompetencyRubricBodySchema,
  UpsertCompetencyAssessmentBodySchema,
  UpsertCompetencyLevelTargetBodySchema,
  type ActivityCompetencyQuery,
  type CreateCompetencyCategoryBody,
  type CreateCompetencyComponentBody,
  type CreateCompetencyIndicatorBody,
  type CreateCompetencyPeriodBody,
  type ImportCompetenciesBody,
  type SetActivityCompetenciesBody,
  type UpdateCompetencyCategoryBody,
  type UpdateCompetencyComponentBody,
  type UpdateCompetencyIndicatorBody,
  type UpdateCompetencyPeriodBody,
  type UpsertActivityCompetencyRubricBody,
  type UpsertCompetencyAssessmentBody,
  type UpsertCompetencyLevelTargetBody,
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

  @Post('courses/:courseId/competencies/import')
  @HttpCode(200)
  @ApiOperation({ summary: 'Import danh mục + chỉ báo năng lực từ file Excel' })
  importCatalog(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Body(zodBody(ImportCompetenciesBodySchema)) body: ImportCompetenciesBody
  ) {
    return this.service.importCatalog(user, courseId, body);
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
  @ApiOperation({ summary: 'Xoá danh mục năng lực (xoá cả thành phần, chỉ báo bên trong)' })
  deleteCategory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteCategory(user, id);
  }

  @Post('competencies/categories/:categoryId/components')
  @ApiOperation({ summary: 'Tạo thành phần năng lực trong 1 danh mục' })
  createComponent(
    @CurrentUser() user: AuthUser,
    @Param('categoryId') categoryId: string,
    @Body(zodBody(CreateCompetencyComponentBodySchema)) body: CreateCompetencyComponentBody
  ) {
    return this.service.createComponent(user, categoryId, body);
  }

  @Patch('competencies/components/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật thành phần năng lực' })
  updateComponent(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateCompetencyComponentBodySchema)) body: UpdateCompetencyComponentBody
  ) {
    return this.service.updateComponent(user, id, body);
  }

  @Delete('competencies/components/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá thành phần năng lực (xoá cả chỉ báo bên trong)' })
  deleteComponent(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteComponent(user, id);
  }

  @Post('competencies/components/:componentId/indicators')
  @ApiOperation({ summary: 'Tạo chỉ báo năng lực trong 1 thành phần' })
  createIndicator(
    @CurrentUser() user: AuthUser,
    @Param('componentId') componentId: string,
    @Body(zodBody(CreateCompetencyIndicatorBodySchema)) body: CreateCompetencyIndicatorBody
  ) {
    return this.service.createIndicator(user, componentId, body);
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

  // ── Kỳ đánh giá năng lực (học kỳ) ──────────────────────────────

  @Get('courses/:courseId/competencies/periods')
  @ApiOperation({ summary: 'Danh sách kỳ đánh giá năng lực của khoá học' })
  listPeriods(@CurrentUser() user: AuthUser, @Param('courseId') courseId: string) {
    return this.service.listPeriods(user, courseId);
  }

  @Post('courses/:courseId/competencies/periods')
  @ApiOperation({ summary: 'Tạo kỳ đánh giá năng lực' })
  createPeriod(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Body(zodBody(CreateCompetencyPeriodBodySchema)) body: CreateCompetencyPeriodBody
  ) {
    return this.service.createPeriod(user, courseId, body);
  }

  @Patch('competencies/periods/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật kỳ đánh giá năng lực' })
  updatePeriod(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateCompetencyPeriodBodySchema)) body: UpdateCompetencyPeriodBody
  ) {
    return this.service.updatePeriod(user, id, body);
  }

  @Delete('competencies/periods/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá kỳ đánh giá năng lực' })
  deletePeriod(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deletePeriod(user, id);
  }

  @Get('courses/:courseId/competencies/periods/:periodId/grid')
  @ApiOperation({ summary: 'Bảng cấp độ + điểm năng lực của cả khoá tại 1 kỳ đánh giá' })
  getPeriodGrid(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Param('periodId') periodId: string
  ) {
    return this.service.getPeriodGrid(user, courseId, periodId);
  }

  @Get('courses/:courseId/competencies/periods/:periodId/categories/:categoryId/export')
  @ApiOperation({ summary: 'Dữ liệu chi tiết để xuất Excel "Tổng hợp kết quả" theo 1 danh mục' })
  getCategoryExportData(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Param('periodId') periodId: string,
    @Param('categoryId') categoryId: string
  ) {
    return this.service.getCategoryExportData(user, courseId, periodId, categoryId);
  }

  @Put('competencies/level-targets')
  @HttpCode(200)
  @ApiOperation({ summary: 'Nhập cấp độ năng lực xuất phát/đích cho 1 học sinh tại 1 kỳ' })
  upsertLevelTarget(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(UpsertCompetencyLevelTargetBodySchema)) body: UpsertCompetencyLevelTargetBody
  ) {
    return this.service.upsertLevelTarget(user, body);
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

  @Patch('competencies/activity/rubric')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sửa rubric 5 mức của 1 chỉ báo riêng cho hoạt động này' })
  updateActivityCompetencyRubric(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(UpsertActivityCompetencyRubricBodySchema))
    body: UpsertActivityCompetencyRubricBody
  ) {
    return this.service.updateActivityCompetencyRubric(user, body);
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
