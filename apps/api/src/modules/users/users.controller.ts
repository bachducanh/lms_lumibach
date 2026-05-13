import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  CreateUserBodySchema,
  UpdateUserBodySchema,
  UpdateProfileBodySchema,
  ImportUsersBodySchema,
  StudentsQuerySchema,
  type CreateUserBody,
  type UpdateUserBody,
  type UpdateProfileBody,
  type ImportUsersBody,
  type StudentsQuery,
} from '@lumibach/types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { zodBody, zodQuery } from '../../common/pipes/zod-query.pipe';
import type { AuthUser } from '../../common/auth/auth.types';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly service: UsersService) {}

  // ── Admin user management ──────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Tạo tài khoản (ADMIN)' })
  createUser(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(CreateUserBodySchema)) body: CreateUserBody
  ) {
    return this.service.createUser(user, body);
  }

  @Patch('me/profile')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật hồ sơ bản thân' })
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(UpdateProfileBodySchema)) body: UpdateProfileBody
  ) {
    return this.service.updateProfile(user, body);
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật tài khoản (ADMIN)' })
  updateUser(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateUserBodySchema)) body: UpdateUserBody
  ) {
    return this.service.updateUser(user, id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá mềm tài khoản (ADMIN)' })
  softDeleteUser(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.softDeleteUser(user, id);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Đặt lại mật khẩu (ADMIN)' })
  resetPassword(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.resetPassword(user, id);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import danh sách người dùng từ JSON rows (ADMIN)' })
  importUsers(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(ImportUsersBodySchema)) body: ImportUsersBody
  ) {
    return this.service.importUsers(user, body.rows);
  }

  // ── Students (TA+) ─────────────────────────────────────────────

  @Get('students')
  @ApiOperation({ summary: 'Danh sách học sinh (TA+)' })
  listStudents(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(StudentsQuerySchema)) query: StudentsQuery
  ) {
    return this.service.listStudents(user, {
      q: query.q,
      courseId: query.courseId,
      page: query.page,
    });
  }

  @Get('students/courses-filter')
  @ApiOperation({ summary: 'Danh sách khoá học cho filter dropdown (TA+)' })
  listCoursesForFilter(@CurrentUser() user: AuthUser) {
    return this.service.listCoursesForFilter(user);
  }

  @Get('students/:id')
  @ApiOperation({ summary: 'Chi tiết học sinh (TA+)' })
  getStudentDetail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getStudentDetail(user, id);
  }
}
