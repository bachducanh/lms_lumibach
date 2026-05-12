import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AppModule } from '@/app.module';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';

/**
 * Bootstrap Nest app cho test — mirror main.ts (cookie-parser, /api prefix,
 * URI versioning, Zod pipe, response interceptor, exception filter).
 *
 * Skip: Pino logger (test dùng default), Swagger, CORS, listen().
 * Caller dùng `app.getHttpServer()` rồi supertest(server).
 *
 * Lifecycle: call `await app.close()` ở afterAll mỗi test file để release
 * DB connections + tránh hang Vitest process.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({ bufferLogs: false });

  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  return app;
}
