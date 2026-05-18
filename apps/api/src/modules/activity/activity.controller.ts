import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import {
  CourseLogsQuerySchema,
  StudentLogsQuerySchema,
  SystemLogsQuerySchema,
  type CourseLogsQuery,
  type StudentLogsQuery,
  type SystemLogsQuery,
} from '@lumibach/types';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { zodQuery } from '../../common/pipes/zod-query.pipe';
import type { AuthUser } from '../../common/auth/auth.types';
import { ActivityService } from './activity.service';

@ApiTags('activities')
@Controller({ path: 'activities', version: '1' })
export class ActivityController {
  constructor(private readonly service: ActivityService) {}

  @Roles('TA', 'TEACHER')
  @Get('course/:courseSlug')
  @ApiOperation({ summary: 'Activity logs scope theo course (TA+ trở lên)' })
  @ApiOkResponse({ description: 'Paginated activity logs' })
  getCourseLogs(
    @CurrentUser() user: AuthUser,
    @Param('courseSlug') courseSlug: string,
    @Query(zodQuery(CourseLogsQuerySchema)) query: CourseLogsQuery
  ) {
    return this.service.getCourseLogs(user, courseSlug, query);
  }

  @Roles('ADMIN')
  @Get('system')
  @ApiOperation({ summary: 'System-wide activity logs (ADMIN only)' })
  getSystemLogs(@Query(zodQuery(SystemLogsQuerySchema)) query: SystemLogsQuery) {
    return this.service.getSystemLogs(query);
  }

  @Roles('TA', 'TEACHER')
  @Get('student/:userId')
  @ApiOperation({ summary: 'Activity logs của 1 học sinh (TA+ trở lên)' })
  getStudentLogs(
    @Param('userId') userId: string,
    @Query(zodQuery(StudentLogsQuerySchema)) query: StudentLogsQuery
  ) {
    return this.service.getStudentLogs(userId, query);
  }

  @Roles('TA', 'TEACHER')
  @Get('courses-filter')
  @ApiOperation({ summary: 'Danh sách courses cho dropdown filter (own/assigned)' })
  getCoursesForFilter(@CurrentUser() user: AuthUser) {
    return this.service.getCoursesForFilter(user);
  }
}
