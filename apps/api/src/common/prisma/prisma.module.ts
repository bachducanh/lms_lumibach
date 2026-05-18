import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, prisma } from '@lumibach/db';

@Global()
@Module({
  providers: [
    {
      provide: PrismaClient,
      useValue: prisma,
    },
  ],
  exports: [PrismaClient],
})
export class PrismaModule implements OnModuleDestroy {
  async onModuleDestroy() {
    await prisma.$disconnect();
  }
}
