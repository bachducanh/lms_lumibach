import { Module } from '@nestjs/common';
import { QuizzesController } from './quizzes.controller';
import { QuizzesService } from './quizzes.service';
import { QuizGateway } from './quiz.gateway';

@Module({
  controllers: [QuizzesController],
  providers: [QuizzesService, QuizGateway],
})
export class QuizzesModule {}
