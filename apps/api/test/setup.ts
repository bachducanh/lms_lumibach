import { afterAll, beforeAll, beforeEach, vi } from 'vitest';
import { testPrisma } from './db';

/**
 * Mock @sentry/node — Sentry SDK chain-loads @sentry/node-core which transitively
 * imports @opentelemetry/context-async-hooks via a hard-coded build path that
 * Vitest's ESM resolver cannot reconcile (path drops `/build/src/` after exports
 * normalization). Production runtime works fine (Node handles it), but tests
 * blow up at module load. We never need real telemetry in tests, so stub the
 * surface area: Sentry.init, integration factories, and captureException.
 */
vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  httpIntegration: () => ({}),
  requestDataIntegration: () => ({}),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

/**
 * Test lifecycle hooks (Vitest globals = false → import explicitly).
 *
 * beforeAll: chỉ connect Prisma. Migration đã chạy ngoài qua `pnpm test:db:up`
 *   (script khởi tạo container + apply migrations). Tránh chạy execSync npx
 *   prisma trong test runtime — npx phụ thuộc PATH worker process.
 *
 * beforeEach: TRUNCATE tất cả public tables (CASCADE, RESTART IDENTITY),
 *   skip _prisma_migrations để giữ migration state. Fast hơn drop+recreate.
 *
 * afterAll: disconnect Prisma (tránh hang process).
 *
 * vi.mock('@/common/auth/jwt-loader'): bypass ESM dynamic import của
 *   @auth/core/jwt (không chạy được trong Vitest vm context). Mock encode/decode
 *   theo format `mock.<salt>.<base64url-payload>.<hmac-secret>`:
 *   - Cùng secret + salt → decode pass.
 *   - Khác secret hoặc khác salt → decode reject (mô phỏng signature mismatch).
 *   - exp < now → decode reject.
 */

vi.mock('@/common/auth/jwt-loader', () => {
  type Payload = Record<string, unknown> & { exp?: number };

  const toB64Url = (s: string) =>
    Buffer.from(s, 'utf8')
      .toString('base64')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const fromB64Url = (s: string) =>
    Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

  // Lấy "fingerprint" của secret để mô phỏng signature check.
  // Không phải HMAC thật — chỉ cần asymmetric: secret khác → tag khác.
  const secretTag = (secret: string | string[]) => {
    const s = Array.isArray(secret) ? secret.join('|') : secret;
    return toB64Url(s).slice(0, 24);
  };

  return {
    getAuthJwt: async () => ({
      encode: async ({
        token,
        secret,
        salt,
      }: {
        token: Payload;
        secret: string | string[];
        salt: string;
      }) => {
        // Encode salt qua base64url để tránh trùng separator `.`
        // (salt thực tế là 'authjs.session-token' có dấu chấm).
        const saltB64 = toB64Url(salt);
        const payloadB64 = toB64Url(JSON.stringify(token));
        return `mock.${saltB64}.${payloadB64}.${secretTag(secret)}`;
      },
      decode: async ({
        token,
        secret,
        salt,
      }: {
        token?: string;
        secret: string | string[];
        salt: string;
      }) => {
        if (typeof token !== 'string') return null;
        const parts = token.split('.');
        if (parts.length !== 4 || parts[0] !== 'mock') {
          throw new Error('Invalid mock token format');
        }
        const [, tokenSaltB64, payloadB64, tokenSecretTag] = parts;
        if (fromB64Url(tokenSaltB64!) !== salt) throw new Error('Salt mismatch');
        if (tokenSecretTag !== secretTag(secret)) throw new Error('Signature mismatch');
        const payload = JSON.parse(fromB64Url(payloadB64!)) as Payload;
        if (payload.exp && (payload.exp as number) < Math.floor(Date.now() / 1000)) {
          throw new Error('Token expired');
        }
        return payload;
      },
    }),
  };
});

beforeAll(async () => {
  await testPrisma.$connect();
});

beforeEach(async () => {
  // Lấy danh sách tables thuộc public schema, skip prisma migration table.
  const rows = await testPrisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `;
  if (rows.length === 0) return;
  const tableList = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await testPrisma.$disconnect();
});
