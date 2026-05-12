import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import type { AuthUser } from '../../common/auth/auth.types';

@Controller({ path: 'me', version: '1' })
export class MeController {
  @Get()
  me(@CurrentUser() user: AuthUser): { user: AuthUser } {
    return { user };
  }
}
