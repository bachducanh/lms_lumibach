import { Controller, Post, Patch, Body } from '@nestjs/common';
import { UserAuthService } from './auth.service';
import { Public } from '../../common/auth/decorators/public.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import type { AuthUser } from '../../common/auth/auth.types';

@Controller('auth')
export class UserAuthController {
  constructor(private readonly service: UserAuthService) {}

  @Public()
  @Post('check-status')
  checkStatus(@Body('email') email: string) {
    return this.service.checkStatus(email);
  }

  @Public()
  @Post('register')
  async register(@Body() body: { email: string; fullName: string; password: string }) {
    const message = await this.service.register(body);
    return { message };
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body('token') token: string) {
    const message = await this.service.verifyEmail(token);
    return { message };
  }

  @Public()
  @Post('resend-verification')
  async resendVerification(@Body('email') email: string) {
    const message = await this.service.resendVerification(email);
    return { message };
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    const message = await this.service.forgotPassword(email);
    return { message };
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; password: string; confirmPassword: string }) {
    const message = await this.service.resetPassword(body);
    return { message };
  }

  @Patch('change-password')
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: { currentPassword: string; newPassword: string; confirmPassword: string }
  ) {
    const message = await this.service.changePassword(user.id, body);
    return { message };
  }
}
