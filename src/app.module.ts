import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { IS_DEV_ENV } from './libs/common/utils/is-dev.util'
import { PrismaModule } from './prisma/prisma.module'
import { CaptchaModule } from './libs/captcha/captcha.module'
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
import { CategoriesModule } from './categories/categories.module'
import { AdsModule } from './ads/ads.module'
import { BullModule } from '@nestjs/bullmq'
import { ScheduleModule } from '@nestjs/schedule'
import { SearchModule } from './search/search.module'
import { RedisModule } from './redis/redis.module'
import { ConversationsModule } from './conversations/conversations.module'
import { BlockedUsersModule } from './blocked-users/blocked-users.module'
import { AdReportsModule } from './ad-reports/ad-reports.module'
import { AdBumpsModule } from './ad-bumps/ad-bumps.module'
import { PremiumModule } from './premium/premium.module'
import { AdServicesModule } from './ad-services/ad-services.module'
import { NotificationsModule } from './notifications/notifications.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: !IS_DEV_ENV,
      isGlobal: true
    }),
    CaptchaModule,
    PrismaModule,

    // host/port раньше были захардкожены на 'localhost'/6379 — работало
    // только пока Redis и сервер были на одной машине. В докер-компоузе
    // (см. обсуждение с пользователем — перенос на Selectel) Redis это
    // отдельный контейнер со своим hostname ('dredis' в docker-compose),
    // и с захардкоженным localhost BullMQ (бамп объявлений,
    // архивация просрочки, статусы услуг и т.п.) просто не смог бы
    // подключиться. REDIS_PORT — из .env строкой, поэтому Number(...).
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD
      }
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // Время в миллисекундах (1 минута)
        limit: 3 // Максимум 3 запроса за эту минуту
      }
    ]),

    AuthModule,
    UserModule,
    ProviderModule,
    EmailConfirmationModule,
    PasswordRecoveryModule,
    TwoFactorAuthModule,
    EmailChangeModule,

    CategoriesModule,
    AdsModule,
    FileModule,
    MailModule,
    SearchModule,
    RedisModule,
    ConversationsModule,
    BlockedUsersModule,
    AdReportsModule,
    AdBumpsModule,
    PremiumModule,
    AdServicesModule,
    NotificationsModule
  ]
})
export class AppModule {}
