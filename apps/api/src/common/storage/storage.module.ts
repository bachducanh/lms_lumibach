import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { ModuleItemCleanupService } from './module-item-cleanup.service';

@Module({
  providers: [StorageService, ModuleItemCleanupService],
  exports: [StorageService, ModuleItemCleanupService],
})
export class StorageModule {}
