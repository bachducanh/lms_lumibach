import type { NextAuthJwtPayload } from '@/common/auth/auth.types';

/**
 * Sign JWE token tương thích NextAuth v5 cho test.
 *
 * Cùng pattern ESM dynamic import như NextAuthGuard (TS CommonJS sẽ transform
 * `import()` → `require()` mặc định, làm hỏng ESM-only @auth/core/jwt).
 *
 * Token được encode với salt = tên cookie ('authjs.session-token') để
 * NextAuthGuard verify thành công. AUTH_SECRET đọc từ .env.test.
 */

type EncodeFn = (params: {
  token: NextAuthJwtPayload;
  secret: string | string[];
  salt: string;
  maxAge?: number;
}) => Promise<string>;

const importEsm = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<unknown>;

const encodePromise: Promise<EncodeFn> = importEsm('@auth/core/jwt').then(
  (m) => (m as { encode: EncodeFn }).encode
);

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
  const encode = await encodePromise;
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
