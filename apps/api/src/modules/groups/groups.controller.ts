import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  AddGroupMembersBodySchema,
  AutoDistributeBodySchema,
  CreateGroupBodySchema,
  CreateGroupingBodySchema,
  SetGroupModeBodySchema,
  UpdateGroupBodySchema,
  UpdateGroupingBodySchema,
  type AddGroupMembersBody,
  type AutoDistributeBody,
  type CreateGroupBody,
  type CreateGroupingBody,
  type SetGroupModeBody,
  type UpdateGroupBody,
  type UpdateGroupingBody,
} from '@lumibach/types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { zodBody } from '../../common/pipes/zod-query.pipe';
import type { AuthUser } from '../../common/auth/auth.types';
import { GroupsService } from './groups.service';

@ApiTags('groups')
@Controller({ version: '1' })
export class GroupsController {
  constructor(private readonly service: GroupsService) {}

  @Get('courses/:courseId/groups')
  @ApiOperation({ summary: 'Chế độ nhóm + danh sách nhóm + phân nhóm của khoá học' })
  getCourseGroups(@CurrentUser() user: AuthUser, @Param('courseId') courseId: string) {
    return this.service.getCourseGroups(user, courseId);
  }

  @Get('courses/:courseId/my-groups')
  @ApiOperation({ summary: 'Nhóm của tôi trong khoá học' })
  getMyGroups(@CurrentUser() user: AuthUser, @Param('courseId') courseId: string) {
    return this.service.getMyGroups(user, courseId);
  }

  @Patch('courses/:courseId/group-mode')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đặt chế độ tương tác nhóm' })
  setGroupMode(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Body(zodBody(SetGroupModeBodySchema)) body: SetGroupModeBody
  ) {
    return this.service.setGroupMode(user, courseId, body);
  }

  @Post('courses/:courseId/groups')
  @ApiOperation({ summary: 'Tạo nhóm' })
  createGroup(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Body(zodBody(CreateGroupBodySchema)) body: CreateGroupBody
  ) {
    return this.service.createGroup(user, courseId, body);
  }

  @Post('courses/:courseId/groups/auto')
  @ApiOperation({ summary: 'Chia nhóm tự động (ngẫu nhiên hoặc để trống tự xếp)' })
  autoDistribute(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Body(zodBody(AutoDistributeBodySchema)) body: AutoDistributeBody
  ) {
    return this.service.autoDistribute(user, courseId, body);
  }

  @Post('courses/:courseId/groupings')
  @ApiOperation({ summary: 'Tạo phân nhóm (gộp nhiều nhóm)' })
  createGrouping(
    @CurrentUser() user: AuthUser,
    @Param('courseId') courseId: string,
    @Body(zodBody(CreateGroupingBodySchema)) body: CreateGroupingBody
  ) {
    return this.service.createGrouping(user, courseId, body);
  }

  @Patch('groups/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật nhóm' })
  updateGroup(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateGroupBodySchema)) body: UpdateGroupBody
  ) {
    return this.service.updateGroup(user, id, body);
  }

  @Delete('groups/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá nhóm' })
  deleteGroup(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteGroup(user, id);
  }

  @Post('groups/:id/members')
  @ApiOperation({ summary: 'Thêm thành viên vào nhóm' })
  addMembers(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(AddGroupMembersBodySchema)) body: AddGroupMembersBody
  ) {
    return this.service.addMembers(user, id, body);
  }

  @Delete('groups/:id/members/:userId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá thành viên khỏi nhóm' })
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string
  ) {
    return this.service.removeMember(user, id, userId);
  }

  @Patch('groupings/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật phân nhóm (đổi tên / danh sách nhóm)' })
  updateGrouping(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateGroupingBodySchema)) body: UpdateGroupingBody
  ) {
    return this.service.updateGrouping(user, id, body);
  }

  @Delete('groupings/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá phân nhóm' })
  deleteGrouping(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteGrouping(user, id);
  }
}
