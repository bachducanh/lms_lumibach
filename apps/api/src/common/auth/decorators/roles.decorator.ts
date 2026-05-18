import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@lumibach/db';

export const ROLES_KEY = 'roles';

/**
 * Yêu cầu user phải có 1 trong các role được liệt kê.
 * ADMIN luôn pass cho mọi @Roles (super-admin bypass).
 *
 * Usage:
 *   @Roles('TEACHER', 'TA')
 *   @Get('grading')
 *   grading() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
