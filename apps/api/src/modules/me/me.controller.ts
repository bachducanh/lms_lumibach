import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import type { AuthUser } from '../../common/auth/auth.types';

@Controller({ path: 'me', version: '1' })
export class MeController {
  @Get()
  me(@CurrentUser() user: AuthUser): { user: AuthUser } {
    return { user };
  }

  /**
   * Demo RBAC: chỉ TEACHER hoặc ADMIN truy cập được.
   * Sẽ thay bằng endpoint nghiệp vụ ở các phase sau.
   */
  @Roles('TEACHER')
  @Get('teacher-zone')
  teacherZone(@CurrentUser() user: AuthUser): { ok: true; userId: string } {
    return { ok: true, userId: user.id };
  }
}
