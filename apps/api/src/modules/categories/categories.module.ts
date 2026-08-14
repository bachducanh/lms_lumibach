import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategoryBankAccessService } from './category-bank-access.service';
import { AuditModule } from '../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoryBankAccessService],
  exports: [CategoriesService, CategoryBankAccessService],
})
export class CategoriesModule {}
