import type { NextAuthJwtPayload } from './auth.types';

/**
 * Loader cho @auth/core/jwt — ESM-only package.
 *
 * Trong CommonJS NestJS, TS sẽ transform `await import(...)` thành
 * `Promise.resolve(require(...))` → require ESM → crash. Bypass bằng
 * `new Function('s', 'return import(s)')`: thân Function là string literal,
 * TS không touch, Node parse như native dynamic import lúc gọi.
 *
 * Module này tồn tại riêng để tests có thể vi.mock() — fake encode/decode
 * thay vì phải load thật @auth/core/jwt (cản tests trong vm context).
 */

export type DecodeFn = (params: {
  token?: string;
  secret: string | string[];
  salt: string;
}) => Promise<NextAuthJwtPayload | null>;

export type EncodeFn = (params: {
  token: NextAuthJwtPayload;
  secret: string | string[];
  salt: string;
  maxAge?: number;
}) => Promise<string>;

type AuthJwtModule = {
  decode: DecodeFn;
  encode: EncodeFn;
};

const importEsm = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<unknown>;

let cached: Promise<AuthJwtModule> | undefined;

export function getAuthJwt(): Promise<AuthJwtModule> {
  if (!cached) {
    cached = importEsm('@auth/core/jwt') as Promise<AuthJwtModule>;
  }
  return cached;
}
