import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LessonCleanupService } from './lesson-cleanup.service';

@Module({
  providers: [StorageService, LessonCleanupService],
  exports: [StorageService, LessonCleanupService],
})
export class StorageModule {}
