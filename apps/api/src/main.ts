import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import path from 'node:path';

loadDotenv({ path: path.resolve(__dirname, '../../../.env') });

import { initSentry } from './common/sentry/sentry';
const sentryActive = initSentry();

import { NestFactory } from '@nestjs/core';
import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger as PinoLogger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SocketIoAdapter } from './common/gateway/io-adapter';

// Dải IP nội bộ (RFC 1918) + localhost. Khi chia sẻ dự án trong mạng LAN, máy
// khác vào bằng http://<IP-máy-chủ>:3000 nên origin không còn là localhost —
// nếu không cho phép thì WebSocket (socket.io nối thẳng vào API) bị CORS chặn.
const LAN_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

/**
 * Danh sách origin được phép gọi API.
 *
 * - Luôn cho phép NEXT_PUBLIC_APP_URL (địa chỉ web chính thức).
 * - CORS_ORIGINS: danh sách bổ sung, ngăn cách bằng dấu phẩy — dùng cho tên miền
 *   phụ hoặc môi trường staging.
 * - Ngoài production, cho phép mọi origin trong mạng LAN để chia sẻ máy chủ dev
 *   mà không phải sửa cấu hình mỗi lần IP đổi.
 */
function buildCorsOrigin(webOrigin: string, extra: string, isProduction: boolean) {
  const allowList = new Set(
    [webOrigin, ...extra.split(',')].map((o) => o.trim().replace(/\/$/, '')).filter(Boolean)
  );

  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Không có Origin: request cùng origin, curl, health check → cho qua.
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/$/, '');
    if (allowList.has(normalized)) return callback(null, true);
    if (!isProduction && LAN_ORIGIN.test(normalized)) return callback(null, true);
    return callback(null, false);
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(PinoLogger));

  const config = app.get(ConfigService);
  const port = config.get<number>('API_PORT', 4000);
  const webOrigin = config.get<string>('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');

  // Chấp nhận cả `/socket.io` lẫn `/socket.io/` — cần cho đường dự phòng
  // long-polling đi qua rewrite của Next.js. Xem common/gateway/io-adapter.ts.
  app.useWebSocketAdapter(new SocketIoAdapter(app));

  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Validation: dùng per-route `zodQuery(schema)` / `zodBody(schema)` thay vì
  // global ZodValidationPipe — tránh @nest-zod/z monkey-patch Zod global
  // error map (crash trên Zod v4).
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const isProduction = config.get<string>('NODE_ENV') === 'production';
  app.enableCors({
    origin: buildCorsOrigin(webOrigin, config.get<string>('CORS_ORIGINS', ''), isProduction),
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('LumiBach API')
    .setDescription('REST API cho LMS_LumiBach (NestJS backend, Phase 1+)')
    .setVersion('1.0')
    .addCookieAuth('authjs.session-token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'authjs.session-token',
      description: 'NextAuth v5 session cookie (JWE encrypted)',
    })
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  app.enableShutdownHooks();

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 API ready at http://localhost:${port}/api/v1`);
  logger.log(`📚 Swagger UI at http://localhost:${port}/api/docs`);
  logger.log(
    `CORS origin allowed: ${webOrigin}` +
      (isProduction ? '' : ' + mọi origin trong mạng LAN (chế độ dev)')
  );
  logger.log(`Sentry: ${sentryActive ? 'enabled' : 'disabled (no SENTRY_DSN)'}`);
}

bootstrap();
