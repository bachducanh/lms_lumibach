import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import path from 'node:path';

loadDotenv({ path: path.resolve(__dirname, '../../../.env') });

import { NestFactory } from '@nestjs/core';
import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZodValidationPipe } from 'nestjs-zod';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('API_PORT', 4000);
  const webOrigin = config.get<string>('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');

  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: [webOrigin],
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
  logger.log(`CORS origin allowed: ${webOrigin}`);
}

bootstrap();
