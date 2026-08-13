import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { ActivityTrashService } from './activity-trash.service';
import { AuditModule } from '../../common/audit/audit.module';
import { StorageModule } from '../../common/storage/storage.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [AuditModule, StorageModule, CategoriesModule],
  controllers: [CoursesController],
  providers: [CoursesService, ActivityTrashService],
})
export class CoursesModule {}
