import { Module } from '@nestjs/common'

import { AuthModule } from '@/auth/auth.module'
import { PrismaService } from '@/prisma/prisma.service'
import { UserModule } from '@/user/user.module'

import { AdServicesController } from './ad-services.controller'
import { AdServicesService } from './ad-services.service'

// UserModule/AuthModule — как и в AdBumpsModule, AuthGuard резолвит
// UserService из UserModule.
@Module({
  imports: [UserModule, AuthModule],
  controllers: [AdServicesController],
  providers: [AdServicesService, PrismaService],
  // AdServicesService нужен YookassaWebhookController — тот физически
  // лежит в AdBumpsModule, поэтому экспортируем сервис, а не переносим
  // сам webhook-контроллер (он и так уже единый на все виды платежей).
  exports: [AdServicesService]
})
export class AdServicesModule {}
