import { Module } from '@nestjs/common';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';
import { Judge0Module } from '../../common/judge0/judge0.module';

@Module({
  imports: [Judge0Module],
  controllers: [AttemptsController],
  providers: [AttemptsService],
})
export class AttemptsModule {}
