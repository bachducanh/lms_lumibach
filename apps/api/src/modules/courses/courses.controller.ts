import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
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
import { Public } from '../../common/auth/decorators/public.decorator';
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

  // PHẢI đứng trước @Get(':slug'), nếu không "trash" sẽ bị coi là một slug.
  @Get('trash')
  @ApiOperation({ summary: 'Danh sách khoá học trong thùng rác (ADMIN: tất cả, GV: của mình)' })
  listTrash(@CurrentUser() user: AuthUser) {
    return this.service.listTrash(user);
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
  @ApiOperation({ summary: 'Chuyển khoá học vào thùng rác (owner/ADMIN)' })
  deleteCourse(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteCourse(user, id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Khôi phục khoá học từ thùng rác (owner/ADMIN)' })
  restoreCourse(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.restoreCourse(user, id);
  }

  @Delete(':id/purge')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá vĩnh viễn khoá học trong thùng rác (owner/ADMIN)' })
  purgeCourse(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.purgeCourse(user, id);
  }

  /**
   * Cron: dọn khoá học quá hạn giữ trong thùng rác.
   * Public vì cron không có phiên đăng nhập — chặn bằng CRON_SECRET thay thế.
   */
  @Public()
  @Post('purge-expired')
  @HttpCode(200)
  @ApiOperation({ summary: 'Dọn khoá học quá hạn thùng rác (cron, cần x-cron-secret)' })
  purgeExpired(@Headers('x-cron-secret') secret?: string) {
    const expected = process.env.CRON_SECRET;
    if (!expected || secret !== expected) throw new UnauthorizedException('Sai cron secret');
    return this.service.purgeExpired();
  }
}
