import { Module } from '@nestjs/common'

import { AuthModule } from '@/auth/auth.module'
import { PremiumModule } from '@/premium/premium.module'
import { PrismaService } from '@/prisma/prisma.service'
import { UserModule } from '@/user/user.module'

import { AdBumpsController } from './ad-bumps.controller'
import { AdBumpsService } from './ad-bumps.service'
import { YookassaWebhookController } from './yookassa-webhook.controller'

@Module({
  // UserModule/AuthModule — AuthGuard (используется в AdBumpsController на
  // обоих роутах) резолвит UserService из UserModule, без импорта здесь
  // Nest не может собрать граф зависимостей. PremiumModule — нужен
  // YookassaWebhookController'у (он физически лежит тут же), который
  // теперь дёргает и PremiumService.handleWebhook.
  imports: [UserModule, AuthModule, PremiumModule],
  controllers: [AdBumpsController, YookassaWebhookController],
  providers: [AdBumpsService, PrismaService]
})
export class AdBumpsModule {}
