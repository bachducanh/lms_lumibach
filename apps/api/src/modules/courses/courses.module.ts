import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { AuditModule } from '../../common/audit/audit.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [AuditModule, CategoriesModule],
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class CoursesModule {}
