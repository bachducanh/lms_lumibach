import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import type { AuthUser } from '../../common/auth/auth.types';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Roles('ADMIN')
  @Get('admin-overview')
  @ApiOperation({ summary: 'System-wide dashboard metrics (ADMIN only)' })
  getAdminOverview() {
    return this.service.getAdminOverview();
  }

  @Roles('TA', 'TEACHER')
  @Get('course/:courseSlug')
  @ApiOperation({ summary: 'Course-level analytics (TA+ / TEACHER own only)' })
  getCourseAnalytics(@CurrentUser() user: AuthUser, @Param('courseSlug') courseSlug: string) {
    return this.service.getCourseAnalytics(user, courseSlug);
  }
}
