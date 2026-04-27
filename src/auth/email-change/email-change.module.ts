import { Module } from '@nestjs/common'
import { EmailChangeController } from './email-change.controller'
import { EmailChangeService } from './email-change.service'
import { MailModule } from '@/libs/mail/mail.module'
import { UserModule } from '@/user/user.module' // Импортируем модуль

@Module({
  imports: [MailModule, UserModule],
  controllers: [EmailChangeController],
  providers: [EmailChangeService]
})
export class EmailChangeModule {}
