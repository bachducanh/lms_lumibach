import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import path from 'node:path';

// Load env vars from monorepo root .env BEFORE Nest bootstrap reads ConfigService
loadDotenv({ path: path.resolve(__dirname, '../../../.env') });

import { NestFactory } from '@nestjs/core';
import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('API_PORT', 4000);
  const webOrigin = config.get<string>('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.enableCors({
    origin: [webOrigin],
    credentials: true,
  });

  app.enableShutdownHooks();

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 API ready at http://localhost:${port}/api/v1`);
  logger.log(`CORS origin allowed: ${webOrigin}`);
}

bootstrap();
