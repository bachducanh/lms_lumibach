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
  type TrashedActivityKind,
} from '@lumibach/types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { Public } from '../../common/auth/decorators/public.decorator';
import { zodBody, zodQuery } from '../../common/pipes/zod-query.pipe';
import type { AuthUser } from '../../common/auth/auth.types';
import { CoursesService } from './courses.service';
import { ActivityTrashService } from './activity-trash.service';

@ApiTags('courses')
@Controller({ path: 'courses', version: '1' })
export class CoursesController {
  constructor(
    private readonly service: CoursesService,
    private readonly activityTrash: ActivityTrashService
  ) {}

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

  // Hai segment nên không đụng @Get(':slug'), nhưng vẫn để cạnh 'trash' cho dễ đọc.
  @Get('trash/activities')
  @ApiOperation({ summary: 'Hoạt động đã xoá trong thùng rác (bài tập, quiz, bài code, đề ôn)' })
  listTrashedActivities(@CurrentUser() user: AuthUser) {
    return this.activityTrash.list(user);
  }

  @Post('trash/activities/:kind/:id/restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Khôi phục hoạt động khỏi thùng rác' })
  restoreActivity(
    @CurrentUser() user: AuthUser,
    @Param('kind') kind: TrashedActivityKind,
    @Param('id') id: string
  ) {
    return this.activityTrash.restore(user, kind, id);
  }

  @Delete('trash/activities/:kind/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá vĩnh viễn hoạt động khỏi thùng rác' })
  purgeActivity(
    @CurrentUser() user: AuthUser,
    @Param('kind') kind: TrashedActivityKind,
    @Param('id') id: string
  ) {
    return this.activityTrash.purge(user, kind, id);
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
    return this.purgeAllExpired();
  }

  /** Dọn cả khoá học lẫn hoạt động lẻ quá hạn trong cùng một lượt cron. */
  private async purgeAllExpired() {
    const courses = await this.service.purgeExpired();
    const activities = await this.activityTrash.purgeExpired();
    return { ...courses, purgedActivities: activities.purged };
  }
}
