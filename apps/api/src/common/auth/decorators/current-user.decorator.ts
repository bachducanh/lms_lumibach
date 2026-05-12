import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth.types';

/**
 * Lấy user đã được NextAuthGuard gắn vào request.
 * Usage: `me(@CurrentUser() user: AuthUser) { ... }`
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.user;
  }
);
