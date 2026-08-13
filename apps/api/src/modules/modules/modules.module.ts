import { Module } from '@nestjs/common';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import { StorageModule } from '../../common/storage/storage.module';
import { ContentBankService } from './content-bank.service';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [StorageModule, CategoriesModule],
  controllers: [ModulesController],
  providers: [ModulesService, ContentBankService],
})
export class ModulesModule {}
