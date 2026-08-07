import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailQueue } from './email.queue';

@Module({
  providers: [EmailService, EmailQueue],
  exports: [EmailService],
})
export class EmailModule {}
