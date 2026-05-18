import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  CreateCourseBodySchema,
  UpdateCourseBodySchema,
  CoursesQuerySchema,
  type CreateCourseBody,
  type UpdateCourseBody,
  type CoursesQuery,
} from '@lumibach/types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { zodBody, zodQuery } from '../../common/pipes/zod-query.pipe';
import type { AuthUser } from '../../common/auth/auth.types';
import { CoursesService } from './courses.service';

@ApiTags('courses')
@Controller({ path: 'courses', version: '1' })
export class CoursesController {
  constructor(private readonly service: CoursesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách khoá học (phân trang, role-scoped)' })
  listCourses(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(CoursesQuerySchema)) query: CoursesQuery
  ) {
    return this.service.listCourses(user, query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Chi tiết khoá học theo slug' })
  getCourseBySlug(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.service.getCourseBySlug(user, slug);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo khoá học (ADMIN only)' })
  createCourse(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(CreateCourseBodySchema)) body: CreateCourseBody
  ) {
    return this.service.createCourse(user, body);
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật khoá học (owner/ADMIN)' })
  updateCourse(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateCourseBodySchema)) body: UpdateCourseBody
  ) {
    return this.service.updateCourse(user, id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá mềm khoá học (owner/ADMIN)' })
  deleteCourse(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteCourse(user, id);
  }
}
