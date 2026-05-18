import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  CategoriesQuerySchema,
  CreateCategoryBodySchema,
  UpdateCategoryBodySchema,
  type CategoriesQuery,
  type CreateCategoryBody,
  type UpdateCategoryBody,
} from '@lumibach/types';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { zodBody, zodQuery } from '../../common/pipes/zod-query.pipe';
import type { AuthUser } from '../../common/auth/auth.types';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@Controller({ path: 'categories', version: '1' })
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get('tree')
  @ApiOperation({ summary: 'Toàn bộ cây danh mục (cached 10 phút)' })
  getTree() {
    return this.service.getTree();
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách danh mục (filter theo parentId)' })
  listCategories(@Query(zodQuery(CategoriesQuerySchema)) query: CategoriesQuery) {
    return this.service.listCategories(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết danh mục (breadcrumb + children)' })
  getCategory(@Param('id') id: string) {
    return this.service.getCategoryById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo danh mục (ADMIN only)' })
  createCategory(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(CreateCategoryBodySchema)) body: CreateCategoryBody
  ) {
    return this.service.createCategory(user, body);
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật danh mục (ADMIN only)' })
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(UpdateCategoryBodySchema)) body: UpdateCategoryBody
  ) {
    return this.service.updateCategory(user, id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xoá mềm danh mục (ADMIN only, chặn nếu còn course/children)' })
  deleteCategory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteCategory(user, id);
  }
}
