import { Module } from '@nestjs/common'

import { AuthModule } from '@/auth/auth.module'
import { PrismaService } from '@/prisma/prisma.service'
import { UserModule } from '@/user/user.module'

import { NotificationsController } from './notifications.controller'
import { NotificationsService } from './notifications.service'

@Module({
  // AuthGuard (используется в NotificationsController) сам зависит от
  // UserService — тот экспортируется UserModule, а не AuthModule (тот
  // экспортирует только AuthService), поэтому нужны оба импорта. Тот же
  // приём, что и в AdsModule/AdReportsModule.
  imports: [UserModule, AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, PrismaService],
  // Экспортируем сервис — AdsModule подключает его, чтобы вызвать
  // notifyAdRejected() прямо из AdsService.reject() (см. AdsModule).
  exports: [NotificationsService]
})
export class NotificationsModule {}
