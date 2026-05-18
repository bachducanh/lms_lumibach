import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NextAuthGuard } from './next-auth.guard';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: NextAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    RolesGuard,
  ],
  exports: [RolesGuard],
})
export class AuthModule {}
