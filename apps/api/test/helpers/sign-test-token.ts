import { getAuthJwt } from '@/common/auth/jwt-loader';

/**
 * Sign JWE token tương thích NextAuth v5 cho test.
 *
 * Dùng cùng module `jwt-loader` với NextAuthGuard — tests vi.mock() module này
 * trong setup.ts để fake encode/decode (tránh ESM dynamic import trong vm context).
 *
 * Token encode với salt = tên cookie ('authjs.session-token') để NextAuthGuard
 * verify thành công. AUTH_SECRET đọc từ .env.test.
 */

export const TEST_COOKIE_NAME = 'authjs.session-token';

export type SignTestTokenOpts = {
  userId: string;
  email?: string;
  role?: string;
  /** Override exp (seconds since epoch). Default: now + 1h. */
  exp?: number;
  /** Override secret (default: process.env.AUTH_SECRET). */
  secret?: string;
};

export async function signTestToken(opts: SignTestTokenOpts): Promise<string> {
  const { encode } = await getAuthJwt();
  const secret = opts.secret ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET missing — load .env.test before tests');

  const now = Math.floor(Date.now() / 1000);
  return encode({
    token: {
      id: opts.userId,
      sub: opts.userId,
      email: opts.email,
      role: opts.role,
      iat: now,
      exp: opts.exp ?? now + 3600,
    },
    secret,
    salt: TEST_COOKIE_NAME,
  });
}

/**
 * Helper: build cookie header string cho supertest.
 *   .set('Cookie', cookieHeader(token))
 */
export function cookieHeader(token: string): string {
  return `${TEST_COOKIE_NAME}=${token}`;
}
