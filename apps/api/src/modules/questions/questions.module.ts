import { Module } from '@nestjs/common';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { Judge0Module } from '../../common/judge0/judge0.module';

@Module({
  imports: [Judge0Module],
  controllers: [QuestionsController],
  providers: [QuestionsService],
})
export class QuestionsModule {}
