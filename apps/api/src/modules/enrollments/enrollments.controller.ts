import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  EnrollUserBodySchema,
  BulkEnrollBodySchema,
  SelfEnrollBodySchema,
  AssignPersonBodySchema,
  ResolveUserBodySchema,
  type EnrollUserBody,
  type BulkEnrollBody,
  type SelfEnrollBody,
  type AssignPersonBody,
  type ResolveUserBody,
} from '@lumibach/types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { zodBody } from '../../common/pipes/zod-query.pipe';
import type { AuthUser } from '../../common/auth/auth.types';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('enrollments')
@Controller({ version: '1' })
export class EnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}

  @Get('courses/:courseId/members')
  @ApiOperation({ summary: 'Danh sách thành viên khoá học' })
  listMembers(@CurrentUser() user: AuthUser, @Param('courseId') courseId: string) {
    return this.service.listCourseMembers(user, courseId);
  }

  @Post('courses/:courseId/enroll')
  @ApiOperation({ summary: 'Enroll một user vào khoá học (TEACHER+)' })
  enrollUser(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Body(zodBody(EnrollUserBodySchema)) body: EnrollUserBody
  ) {
    return this.service.enrollUser(user, courseId, body);
  }

  @Post('courses/:courseId/enroll/bulk')
  @ApiOperation({ summary: 'Enroll nhiều user (TEACHER+)' })
  bulkEnroll(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Body(zodBody(BulkEnrollBodySchema)) body: BulkEnrollBody
  ) {
    return this.service.bulkEnroll(user, courseId, body);
  }

  @Post('courses/:courseId/tas')
  @ApiOperation({ summary: 'Gán trợ giảng (TEACHER+)' })
  assignTA(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Body(zodBody(AssignPersonBodySchema)) body: AssignPersonBody
  ) {
    return this.service.assignTA(user, courseId, body);
  }

  @Delete('courses/:courseId/tas/:taId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá trợ giảng (TEACHER+)' })
  removeTA(@CurrentUser() user: AuthUser, @Param('taId') taId: string) {
    return this.service.removeTA(user, taId);
  }

  @Post('courses/:courseId/co-teachers')
  @ApiOperation({ summary: 'Thêm giáo viên cùng dạy (TEACHER+)' })
  addCoTeacher(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Body(zodBody(AssignPersonBodySchema)) body: AssignPersonBody
  ) {
    return this.service.addCoTeacher(user, courseId, body);
  }

  @Delete('courses/:courseId/co-teachers/:coTeacherId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá giáo viên cùng dạy (TEACHER+)' })
  removeCoTeacher(@CurrentUser() user: AuthUser, @Param('coTeacherId') coTeacherId: string) {
    return this.service.removeCoTeacher(user, coTeacherId);
  }

  @Post('courses/:courseId/enrollment-code')
  @ApiOperation({ summary: 'Tạo/tái tạo mã tham gia khoá học (TEACHER+)' })
  generateCode(@CurrentUser() user: AuthUser, @Param('courseId') courseId: string) {
    return this.service.generateEnrollmentCode(user, courseId);
  }

  @Post('enrollments/self-enroll')
  @ApiOperation({ summary: 'Học sinh tự đăng ký qua mã' })
  selfEnroll(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(SelfEnrollBodySchema)) body: SelfEnrollBody
  ) {
    return this.service.selfEnroll(user, body);
  }

  @Delete('enrollments/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá học sinh khỏi lớp (TEACHER+)' })
  unenroll(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.unenroll(user, id);
  }

  @Post('enrollments/resolve-user')
  @ApiOperation({ summary: 'Lookup user by email/username/full-name (TEACHER+)' })
  resolveUser(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(ResolveUserBodySchema)) body: ResolveUserBody
  ) {
    return this.service.resolveUser(user, body.identifier);
  }
}
