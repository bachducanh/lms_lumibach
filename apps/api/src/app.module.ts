import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './common/auth/auth.module';
import { CacheModule } from './common/cache/cache.module';
import { HealthModule } from './common/health/health.module';
import { MeModule } from './modules/me/me.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true, colorize: true } },
        redact: {
          paths: [
            'req.headers.cookie',
            'req.headers.authorization',
            'res.headers["set-cookie"]',
            '*.password',
            '*.passwordHash',
            '*.token',
            '*.secret',
            '*.refreshToken',
          ],
          censor: '[REDACTED]',
        },
        customLogLevel(_req, res, err) {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
    PrismaModule,
    CacheModule,
    AuthModule,
    HealthModule,
    MeModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
