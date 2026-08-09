import { Module } from '@nestjs/common'

import { AdServicesModule } from '@/ad-services/ad-services.module'
import { AuthModule } from '@/auth/auth.module'
import { PremiumModule } from '@/premium/premium.module'
import { PrismaService } from '@/prisma/prisma.service'
import { UserModule } from '@/user/user.module'

import { AdBumpsController } from './ad-bumps.controller'
import { AdBumpsService } from './ad-bumps.service'
import { YookassaWebhookController } from './yookassa-webhook.controller'
import { AdAutoBumpWorker } from './workers/ad-auto-bump.worker'

@Module({
  // UserModule/AuthModule — AuthGuard (используется в AdBumpsController на
  // обоих роутах) резолвит UserService из UserModule, без импорта здесь
  // Nest не может собрать граф зависимостей. PremiumModule/AdServicesModule
  // — нужны YookassaWebhookController'у (он физически лежит тут же),
  // который теперь дёргает handleWebhook у всех трёх сервисов оплаты.
  imports: [UserModule, AuthModule, PremiumModule, AdServicesModule],
  controllers: [AdBumpsController, YookassaWebhookController],
  // AdAutoBumpWorker — общий шедулер для этой услуги и для премиум-
  // автоподъёма (см. сам файл воркера), поэтому лежит здесь, а не в
  // PremiumModule — PremiumModule и так уже импортируется этим модулем.
  providers: [AdBumpsService, PrismaService, AdAutoBumpWorker]
})
export class AdBumpsModule {}
