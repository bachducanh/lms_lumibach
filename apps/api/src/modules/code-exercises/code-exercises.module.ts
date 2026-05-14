import { Module } from '@nestjs/common';
import { Judge0Module } from '../../common/judge0/judge0.module';
import { CodeExercisesController } from './code-exercises.controller';
import { CodeExercisesService } from './code-exercises.service';

@Module({
  imports: [Judge0Module],
  controllers: [CodeExercisesController],
  providers: [CodeExercisesService],
})
export class CodeExercisesModule {}
