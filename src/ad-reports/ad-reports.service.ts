import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@/generated/prisma/client'
import { AdReportStatus } from '@/generated/prisma/enums'

import { PrismaService } from '@/prisma/prisma.service'

import { CreateAdReportDto } from './dto/create-ad-report.dto'

// Общий include для отдачи жалобы админу — нужны и объявление (посмотреть,
// на что жалуются), и сам жалующийся (на всякий случай, если понадобится
// связаться/разобраться в контексте).
const ADMIN_REPORT_INCLUDE = {
  ad: { select: { id: true, title: true, images: true } },
  user: { select: { id: true, displayName: true } }
} satisfies Prisma.AdReportInclude

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

  // Все жалобы сразу, по всем объявлениям — только для модератора (см.
  // AdReportsAdminController). PENDING первыми (см. порядок значений в
  // enum AdReportStatus), внутри статуса — новые сверху.
  async findAll() {
    return this.prisma.adReport.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: ADMIN_REPORT_INCLUDE
    })
  }

  async updateStatus(id: string, status: AdReportStatus) {
    const report = await this.prisma.adReport.findUnique({ where: { id } })

    if (!report) {
      throw new NotFoundException('Жалоба не найдена')
    }

    return this.prisma.adReport.update({
      where: { id },
      data: { status },
      include: ADMIN_REPORT_INCLUDE
    })
  }
}
