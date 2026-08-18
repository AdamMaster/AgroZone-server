import { forwardRef, Module } from '@nestjs/common'
import { EmailConfirmationService } from './email-confirmation.service'
import { EmailConfirmationController } from './email-confirmation.controller'
import { MailModule } from '@/libs/mail/mail.module'
import { AuthModule } from '../auth.module'
import { UserService } from '@/user/user.service'
import { MailService } from '@/libs/mail/mail.service'
import { ZvonokService } from '@/libs/zvonok/zvonok.service'

@Module({
  imports: [MailModule, forwardRef(() => AuthModule)],
  controllers: [EmailConfirmationController],
  providers: [EmailConfirmationService, UserService, MailService, ZvonokService],
  exports: [EmailConfirmationService]
})
export class EmailConfirmationModule {}
