import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '@/prisma/prisma.service'
import { AdStatus } from '@/generated/prisma/client'

@Injectable()
export class AdsExpirationWorker {
  constructor(private readonly prisma: PrismaService) {}

  @Cron('*/5 * * * *') // каждые 5 минут
  async handleExpiredAds() {
    console.log('AdsExpirationWorker started')
    const now = new Date()

    const result = await this.prisma.ad.updateMany({
      where: {
        status: AdStatus.PUBLISHED,
        expiresAt: { lte: now }
      },
      data: {
        status: AdStatus.EXPIRED
      }
    })
  }
}
