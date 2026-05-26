import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  CreateReflectionBodySchema,
  UpdateReflectionBodySchema,
  type CreateReflectionBody,
  type UpdateReflectionBody,
} from '@lumibach/types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { zodBody } from '../../common/pipes/zod-query.pipe';
import type { AuthUser } from '../../common/auth/auth.types';
import { PortfolioService } from './portfolio.service';

@ApiTags('portfolio')
@Controller({ version: '1' })
export class PortfolioController {
  constructor(private readonly service: PortfolioService) {}

  @Get('portfolio/me/overview')
  @ApiOperation({ summary: 'Tổng quan hồ sơ học tập của người dùng hiện tại' })
  getMyPortfolioOverview(@CurrentUser() user: AuthUser) {
    return this.service.getOverview(user);
  }

  @Get('portfolio/students/:studentId/overview')
  @ApiOperation({ summary: 'Tổng quan hồ sơ học tập của học sinh trên các khoá được phép xem' })
  getStudentPortfolioOverview(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string
  ) {
    return this.service.getOverview(user, studentId);
  }

  @Get('courses/:courseId/portfolio/:studentId')
  @ApiOperation({ summary: 'Hồ sơ học tập của học sinh (chính chủ hoặc giáo viên)' })
  getPortfolio(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Param('studentId') studentId: string
  ) {
    return this.service.getPortfolio(user, courseId, studentId);
  }

  @Post('courses/:courseId/portfolio/reflections')
  @ApiOperation({ summary: 'Thêm mục tự đánh giá vào hồ sơ' })
  createReflection(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Body(zodBody(CreateReflectionBodySchema)) body: CreateReflectionBody
  ) {
    return this.service.createReflection(user, courseId, body);
  }

  @Patch('portfolio/reflections/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sửa mục tự đánh giá' })
  updateReflection(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateReflectionBodySchema)) body: UpdateReflectionBody
  ) {
    return this.service.updateReflection(user, id, body);
  }

  @Delete('portfolio/reflections/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá mục tự đánh giá' })
  deleteReflection(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteReflection(user, id);
  }
}
