import { Module } from '@nestjs/common';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [ModulesController],
  providers: [ModulesService],
})
export class ModulesModule {}
