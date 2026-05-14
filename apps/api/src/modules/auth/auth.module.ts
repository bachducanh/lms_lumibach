import { Module } from '@nestjs/common';
import { UserAuthController } from './auth.controller';
import { UserAuthService } from './auth.service';
import { EmailModule } from '../../common/email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [UserAuthController],
  providers: [UserAuthService],
})
export class UserAuthModule {}
