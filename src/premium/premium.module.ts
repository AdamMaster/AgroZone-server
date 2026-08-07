import { Module } from '@nestjs/common'

import { AuthModule } from '@/auth/auth.module'
import { PrismaService } from '@/prisma/prisma.service'
import { UserModule } from '@/user/user.module'

import { PremiumController } from './premium.controller'
import { PremiumService } from './premium.service'

@Module({
  // UserModule/AuthModule — AuthGuard резолвит UserService из UserModule,
  // без импорта здесь Nest не соберёт граф зависимостей (см. тот же фикс
  // в AdBumpsModule).
  imports: [UserModule, AuthModule],
  controllers: [PremiumController],
  providers: [PremiumService, PrismaService],
  // Экспортируем сервис — общий вебхук ЮKassa (YookassaWebhookController,
  // физически лежит в ad-bumps/) должен уметь реконсилить и платежи за
  // премиум, не только за поднятия объявлений.
  exports: [PremiumService]
})
export class PremiumModule {}
