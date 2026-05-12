import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NextAuthGuard } from './next-auth.guard';

@Global()
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: NextAuthGuard,
    },
  ],
})
export class AuthModule {}
