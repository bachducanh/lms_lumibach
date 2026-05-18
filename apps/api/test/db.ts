import { PrismaClient } from '@lumibach/db';

/**
 * Prisma client cho test environment.
 *
 * Singleton per worker (Vitest singleFork = 1 worker), connect tới test DB
 * qua DATABASE_URL từ .env.test (port 5433). Disconnect ở afterAll trong setup.ts.
 */
export const testPrisma = new PrismaClient({
  log: ['error'],
});
