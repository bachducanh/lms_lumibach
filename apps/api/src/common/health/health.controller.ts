import { Controller, Get } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';
import { Public } from '../auth/decorators/public.decorator';

@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly prisma: PrismaClient) {}

  @Public()
  @Get()
  async check() {
    let db: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }

    return {
      status: db === 'up' ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        api: 'up',
        db,
      },
    };
  }
}
