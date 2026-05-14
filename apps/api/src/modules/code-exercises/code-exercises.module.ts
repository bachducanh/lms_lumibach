import { Module } from '@nestjs/common';
import { Judge0Module } from '../../common/judge0/judge0.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CodeExercisesController } from './code-exercises.controller';
import { CodeExercisesService } from './code-exercises.service';
import { CodeExecutionGateway } from './code-execution.gateway';

@Module({
  imports: [Judge0Module, NotificationsModule],
  controllers: [CodeExercisesController],
  providers: [CodeExercisesService, CodeExecutionGateway],
})
export class CodeExercisesModule {}
