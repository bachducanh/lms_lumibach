import { Module } from '@nestjs/common';
import { Judge0Module } from '../../common/judge0/judge0.module';
import { SandboxController } from './sandbox.controller';
import { SandboxService } from './sandbox.service';

@Module({
  imports: [Judge0Module],
  controllers: [SandboxController],
  providers: [SandboxService],
})
export class SandboxModule {}
