import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  CreateModuleBodySchema,
  UpdateModuleBodySchema,
  ReorderModulesBodySchema,
  ReorderItemsBodySchema,
  AddModuleItemBodySchema,
  ModulesQuerySchema,
  NavItemsQuerySchema,
  UpdateModuleItemGroupSettingsBodySchema,
  type CreateModuleBody,
  type UpdateModuleBody,
  type ReorderModulesBody,
  type ReorderItemsBody,
  type AddModuleItemBody,
  type ModulesQuery,
  type NavItemsQuery,
  type UpdateModuleItemGroupSettingsBody,
} from '@lumibach/types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { zodBody, zodQuery } from '../../common/pipes/zod-query.pipe';
import type { AuthUser } from '../../common/auth/auth.types';
import { ModulesService } from './modules.service';

@ApiTags('modules')
@Controller({ path: 'modules', version: '1' })
export class ModulesController {
  constructor(private readonly service: ModulesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách chương của khoá học' })
  listModules(
    @CurrentUser() _user: AuthUser,
    @Query(zodQuery(ModulesQuerySchema)) query: ModulesQuery
  ) {
    return this.service.listModules(query.courseId, query.publishedOnly ?? false);
  }

  @Get('nav')
  @ApiOperation({ summary: 'Nav items cho prev/next (all activities in course)' })
  listNavItems(
    @CurrentUser() _user: AuthUser,
    @Query(zodQuery(NavItemsQuerySchema)) query: NavItemsQuery
  ) {
    return this.service.listCourseNavItems(query.courseId, query.publishedOnly ?? false);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo chương mới (TEACHER+/owner)' })
  createModule(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(CreateModuleBodySchema)) body: CreateModuleBody
  ) {
    return this.service.createModule(user, body);
  }

  @Patch('reorder')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reorder chương (TEACHER+/owner)' })
  reorderModules(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(ReorderModulesBodySchema)) body: ReorderModulesBody
  ) {
    return this.service.reorderModules(user, body);
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật chương (TEACHER+/owner)' })
  updateModule(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateModuleBodySchema)) body: UpdateModuleBody
  ) {
    return this.service.updateModule(user, id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá chương (TEACHER+/owner)' })
  deleteModule(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteModule(user, id);
  }

  @Patch(':id/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Toggle publish chương' })
  togglePublish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.toggleModulePublish(user, id);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Thêm item vào chương' })
  addItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(AddModuleItemBodySchema)) body: AddModuleItemBody
  ) {
    return this.service.addModuleItem(user, id, body);
  }

  @Patch(':id/items/reorder')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reorder items trong chương' })
  reorderItems(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(ReorderItemsBodySchema)) body: ReorderItemsBody
  ) {
    return this.service.reorderModuleItems(user, id, body);
  }

  @Patch('items/:itemId/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Toggle publish item' })
  toggleItemPublish(@CurrentUser() user: AuthUser, @Param('itemId') itemId: string) {
    return this.service.toggleModuleItemPublish(user, itemId);
  }

  @Delete('items/:itemId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá item' })
  deleteItem(@CurrentUser() user: AuthUser, @Param('itemId') itemId: string) {
    return this.service.deleteModuleItem(user, itemId);
  }

  @Patch('items/:itemId/group-settings')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Đặt chế độ nhóm cho mục: NO_GROUPS / VISIBLE_GROUPS / SEPARATE_GROUPS',
  })
  setGroupSettings(
    @CurrentUser() user: AuthUser,
    @Param('itemId') itemId: string,
    @Body(zodBody(UpdateModuleItemGroupSettingsBodySchema))
    body: UpdateModuleItemGroupSettingsBody
  ) {
    return this.service.updateModuleItemGroupSettings(user, itemId, body);
  }

  @Patch(':id/group-settings')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Áp dụng chế độ nhóm cho toàn bộ hoạt động trong chương',
  })
  setModuleGroupSettings(
    @CurrentUser() user: AuthUser,
    @Param('id') moduleId: string,
    @Body(zodBody(UpdateModuleItemGroupSettingsBodySchema))
    body: UpdateModuleItemGroupSettingsBody
  ) {
    return this.service.updateModuleGroupSettings(user, moduleId, body);
  }
}
