import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import type { AuthUser } from '../../common/auth/auth.types';
import { ScratchService } from './scratch.service';

@ApiTags('scratch')
@Controller({ path: 'scratch', version: '1' })
export class ScratchController {
  constructor(private readonly service: ScratchService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo bài Scratch (TEACHER+)' })
  create(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.service.create(user, body as Parameters<ScratchService['create']>[1]);
  }

  // `submissions/:subId` has 2 segments — no conflict with `:id`
  @Patch('submissions/:subId/grade')
  @HttpCode(200)
  @ApiOperation({ summary: 'Chấm điểm bài Scratch (TA+)' })
  grade(
    @CurrentUser() user: AuthUser,
    @Param('subId') subId: string,
    @Body() body: { score: number; maxScore?: number; feedback?: string }
  ) {
    return this.service.grade(user, subId, body);
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật bài Scratch (TEACHER+)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.service.update(user, id, body as Parameters<ScratchService['update']>[2]);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Nộp bài Scratch (.sb3 URL)' })
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { sb3Url: string; filename?: string }
  ) {
    return this.service.submit(user, id, body);
  }

  @Get(':id/my-submissions')
  @ApiOperation({ summary: 'Danh sách bài nộp của mình' })
  mySubmissions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.mySubmissions(user, id);
  }

  @Get(':id/submissions')
  @ApiOperation({ summary: 'Tất cả bài nộp (TA+)' })
  allSubmissions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.allSubmissions(user, id);
  }
}
