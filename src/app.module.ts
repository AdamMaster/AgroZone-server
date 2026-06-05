import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { IS_DEV_ENV } from './libs/common/utils/is-dev.util'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UserModule } from './user/user.module'
import { ProviderModule } from './auth/provider/provider.module'
import { MailModule } from './libs/mail/mail.module'
import { EmailConfirmationModule } from './auth/email-confirmation/email-confirmation.module'
import { PasswordRecoveryModule } from './auth/password-recovery/password-recovery.module'
import { TwoFactorAuthModule } from './auth/two-factor-auth/two-factor-auth.module'
import { EmailChangeModule } from './auth/email-change/email-change.module'
import { FileModule } from './file/file.module'
import { ThrottlerModule } from '@nestjs/throttler'
import { CategoriesModule } from './categories/categories.module';
import { AdsModule } from './ads/ads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: !IS_DEV_ENV,
      isGlobal: true
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    ProviderModule,
    MailModule,
    EmailConfirmationModule,
    PasswordRecoveryModule,
    TwoFactorAuthModule,
    EmailChangeModule,
    FileModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // Время в миллисекундах (1 минута)
        limit: 3 // Максимум 3 запроса за эту минуту
      }
    ]),
    CategoriesModule,
    AdsModule
  ]
})
export class AppModule {}
