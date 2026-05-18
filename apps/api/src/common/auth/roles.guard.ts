import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from '@lumibach/db';
import { ROLES_KEY } from './decorators/roles.decorator';
import type { AuthUser } from './auth.types';

/**
 * Check role của user (đã được NextAuthGuard gắn vào req.user).
 *
 * Quy ước:
 * - Không @Roles → pass (chỉ cần đăng nhập).
 * - ADMIN → always pass.
 * - Khác → user.role phải nằm trong danh sách @Roles.
 *
 * Áp dụng theo route, KHÔNG global (để route public + route protected
 * mặc định chỉ check NextAuthGuard).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as AuthUser | undefined;

    if (!user) {
      throw new ForbiddenException('No authenticated user on request');
    }
    if (user.role === 'ADMIN') return true;
    if (required.includes(user.role)) return true;

    throw new ForbiddenException(
      `Role ${user.role} not allowed; need one of [${required.join(', ')}]`
    );
  }
}
