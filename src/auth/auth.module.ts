import { forwardRef, Module } from '@nestjs/common'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { UserService } from '@/user/user.service'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ProviderModule } from './provider/provider.module'
import { getProvidersConfig } from '@/config/providers.config'
import { EmailConfirmationModule } from './email-confirmation/email-confirmation.module'
import { MailService } from '@/libs/mail/mail.service'
import { TwoFactorAuthService } from './two-factor-auth/two-factor-auth.service'
import { ZvonokService } from '@/libs/zvonok/zvonok.service'

@Module({
  imports: [
    ProviderModule.registerAsync({
      imports: [ConfigModule],
      useFactory: getProvidersConfig,
      inject: [ConfigService]
    }),
    forwardRef(() => EmailConfirmationModule)
  ],
  controllers: [AuthController],
  providers: [AuthService, UserService, MailService, TwoFactorAuthService, ZvonokService],
  exports: [AuthService]
})
export class AuthModule {}
