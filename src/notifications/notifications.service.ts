import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { NotificationType } from 'prisma/generated/client'

import { PrismaService } from '@/prisma/prisma.service'

import { FindNotificationsQueryDto } from './dto/find-notifications-query.dto'

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMyNotifications(userId: string, query: FindNotificationsQueryDto) {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 50)
    const skip = (page - 1) * limit

    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(query.isRead !== undefined && { isRead: query.isRead })
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    })
  }

  async countUnread(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false }
    })

    return { count }
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } })

    if (!notification) {
      throw new NotFoundException('Уведомление не найдено')
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Это уведомление принадлежит другому пользователю')
    }

    if (notification.isRead) {
      return notification
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true }
    })
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    })

    return { success: true }
  }

  // Вызывается из AdsService.reject() в момент отклонения объявления
  // модератором — раньше об этом можно было узнать только зайдя в "Мои
  // объявления" и заметив иконку с причиной (см. обсуждение с
  // пользователем).
  async notifyAdRejected(userId: string, adId: string, adTitle: string, reason: string | null) {
    return this.prisma.notification.create({
      data: {
        userId,
        type: NotificationType.AD_REJECTED,
        title: 'Объявление отклонено',
        message: reason
          ? `Объявление «${adTitle}» отклонено модератором. Причина: ${reason}`
          : `Объявление «${adTitle}» отклонено модератором.`,
        link: `/ads/${adId}/edit`
      }
    })
  }
}
