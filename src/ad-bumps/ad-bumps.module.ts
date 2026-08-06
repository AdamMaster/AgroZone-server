import { Module } from '@nestjs/common'

import { PrismaService } from '@/prisma/prisma.service'

import { AdBumpsController } from './ad-bumps.controller'
import { AdBumpsService } from './ad-bumps.service'
import { YookassaWebhookController } from './yookassa-webhook.controller'

@Module({
  controllers: [AdBumpsController, YookassaWebhookController],
  providers: [AdBumpsService, PrismaService]
})
export class AdBumpsModule {}
