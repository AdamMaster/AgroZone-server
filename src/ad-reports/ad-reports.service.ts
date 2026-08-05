import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from 'prisma/generated/client'

import { PrismaService } from '@/prisma/prisma.service'

import { CreateAdReportDto } from './dto/create-ad-report.dto'

@Injectable()
export class AdReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // Жалоба на КОНТЕНТ объявления — не то же самое, что блокировка юзера в
  // чате (см. BlockedUsersService): та касается отношений между двумя
  // конкретными людьми, эта — самого объявления, и должна быть видна
  // модератору вне зависимости от того, был ли вообще диалог с продавцом.
  async createReport(userId: string, adId: string, dto: CreateAdReportDto) {
    const ad = await this.prisma.ad.findUnique({
      where: { id: adId },
      select: { id: true, userId: true }
    })

    if (!ad) {
      throw new NotFoundException('Объявление не найдено')
    }

    if (ad.userId === userId) {
      throw new ForbiddenException('Нельзя пожаловаться на своё же объявление')
    }

    try {
      return await this.prisma.adReport.create({
        data: { adId, userId, reason: dto.reason, comment: dto.comment }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // @@unique([adId, userId]) — жалоба от этого юзера на это объявление
        // уже есть, не даём заспамить повторными жалобами.
        if (error.code === 'P2002') {
          throw new ConflictException('Вы уже отправляли жалобу на это объявление')
        }
      }

      throw error
    }
  }
}
