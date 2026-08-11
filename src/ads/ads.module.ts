import { Module } from '@nestjs/common'
import { AdsService } from './ads.service'
import { AdsController } from './ads.controller'
import { PrismaService } from '@/prisma/prisma.service'
import { UserModule } from '@/user/user.module'
import { FileModule } from '../file/file.module'
import { AdStateMachineService } from './ad-state-machine.service'
import { BullModule } from '@nestjs/bullmq'
import { AdsExpirationWorker } from './workers/ads-expiration.worker'
import { AdsArchivePurgeWorker } from './workers/ads-archive-purge.worker'
import { AdViewsRollupWorker } from './workers/ad-views-rollup.worker'
import { CategoriesModule } from '@/categories/categories.module'
import { AuthModule } from '@/auth/auth.module'
import { NotificationsModule } from '@/notifications/notifications.module'

@Module({
  imports: [
    UserModule,
    FileModule,
    BullModule.registerQueue({
      name: 'ads'
    }),
    CategoriesModule,
    AuthModule,
    NotificationsModule
  ],
  controllers: [AdsController],
  providers: [
    AdsService,
    PrismaService,
    AdStateMachineService,
    AdsExpirationWorker,
    AdsArchivePurgeWorker,
    AdViewsRollupWorker
  ]
})
export class AdsModule {}
