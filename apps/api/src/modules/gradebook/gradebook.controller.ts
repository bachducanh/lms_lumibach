import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import type { AuthUser } from '../../common/auth/auth.types';
import { GradebookService } from './gradebook.service';

@ApiTags('gradebook')
@Controller({ path: 'gradebook', version: '1' })
export class GradebookController {
  constructor(private readonly service: GradebookService) {}

  @Get()
  @ApiOperation({ summary: 'Bảng điểm khoá học (TA+)' })
  get(@CurrentUser() user: AuthUser, @Query('courseId') courseId: string) {
    return this.service.get(user, courseId);
  }
}
