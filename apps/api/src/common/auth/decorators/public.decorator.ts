import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Đánh dấu route public — bỏ qua NextAuthGuard global.
 * Dùng cho /health, /docs, login flow proxy, etc.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
