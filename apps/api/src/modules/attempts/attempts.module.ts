import { Module } from '@nestjs/common';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';
import { Judge0Module } from '../../common/judge0/judge0.module';
import { StorageModule } from '../../common/storage/storage.module';
import { ProctorController } from './proctor.controller';
import { ProctorService } from './proctor.service';

@Module({
  imports: [Judge0Module, StorageModule],
  controllers: [AttemptsController, ProctorController],
  providers: [AttemptsService, ProctorService],
})
export class AttemptsModule {}
