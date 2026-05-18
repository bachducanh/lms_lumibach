import { Global, Logger, Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';

/**
 * Global cache module:
 * - Redis store nếu có REDIS_URL (cache-aside cho endpoint read-heavy ở Phase 3+)
 * - Fallback in-memory nếu không có Redis (dev không cần Redis)
 *
 * Inject CACHE_MANAGER trong service:
 *   constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}
 */
@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      isGlobal: true,
      useFactory: async (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        const logger = new Logger('CacheModule');

        if (!url) {
          logger.warn(
            'REDIS_URL not set — using in-memory cache (no shared cache across instances)'
          );
          return { ttl: 60_000 };
        }

        try {
          const store = await redisStore({
            url,
            ttl: 60_000,
          });
          logger.log(`Redis cache connected: ${url.replace(/:[^@/]+@/, ':***@')}`);
          return { store, ttl: 60_000 };
        } catch (err) {
          logger.error(`Redis connect failed (${(err as Error).message}) — fallback to in-memory`);
          return { ttl: 60_000 };
        }
      },
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}
