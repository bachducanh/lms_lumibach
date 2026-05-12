import { execSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { testPrisma } from './db';

/**
 * Test lifecycle hooks (Vitest globals = false → import explicitly).
 *
 * beforeAll: run prisma migrate deploy lên test DB (1 lần / process).
 *   - Cần DATABASE_URL từ .env.test (vitest CLI đã load qua dotenv).
 *   - tmpfs container → migration phải rerun mỗi lần container restart.
 *
 * beforeEach: TRUNCATE tất cả tables (giữ schema, reset data).
 *   - Nhanh hơn drop+migrate.
 *   - Skip _prisma_migrations để không invalidate migration state.
 *
 * afterAll: disconnect Prisma client (tránh hang process).
 */

let migrated = false;

beforeAll(async () => {
  if (!migrated) {
    const schemaPath = path.resolve(__dirname, '../../../packages/db/prisma/schema.prisma');
    // migrate deploy không tương tác, idempotent — chạy mọi pending migrations.
    execSync(`npx prisma migrate deploy --schema "${schemaPath}"`, {
      stdio: 'inherit',
      env: process.env,
    });
    migrated = true;
  }
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
  // RESTART IDENTITY để reset auto-increment; CASCADE để bỏ qua FK constraint.
  await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await testPrisma.$disconnect();
});
