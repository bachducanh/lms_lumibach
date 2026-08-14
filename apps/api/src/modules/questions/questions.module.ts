import { Module } from '@nestjs/common';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { Judge0Module } from '../../common/judge0/judge0.module';
import { QuestionBankService } from './question-bank.service';
import { CategoryQuestionBankService } from './category-question-bank.service';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [Judge0Module, CategoriesModule],
  controllers: [QuestionsController],
  providers: [QuestionsService, QuestionBankService, CategoryQuestionBankService],
})
export class QuestionsModule {}
