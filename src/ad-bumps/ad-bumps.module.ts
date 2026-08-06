import { Module } from '@nestjs/common'

import { AuthModule } from '@/auth/auth.module'
import { PrismaService } from '@/prisma/prisma.service'
import { UserModule } from '@/user/user.module'

import { AdBumpsController } from './ad-bumps.controller'
import { AdBumpsService } from './ad-bumps.service'
import { YookassaWebhookController } from './yookassa-webhook.controller'

@Module({
  // UserModule/AuthModule — AuthGuard (используется в AdBumpsController на
  // обоих роутах) резолвит UserService из UserModule, без импорта здесь
  // Nest не может собрать граф зависимостей.
  imports: [UserModule, AuthModule],
  controllers: [AdBumpsController, YookassaWebhookController],
  providers: [AdBumpsService, PrismaService]
})
export class AdBumpsModule {}
