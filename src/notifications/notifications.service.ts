import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { NotificationType } from '@/generated/prisma/client'

import { MailService } from '@/libs/mail/mail.service'
import { PrismaService } from '@/prisma/prisma.service'

import { FindNotificationsQueryDto } from './dto/find-notifications-query.dto'

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService
  ) {}

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
  // пользователем). Дублируем письмом (см. обсуждение — фаза 2): in-app
  // уведомление доходит только если продавец сам зайдёт на сайт, письмо —
  // независимо от этого.
  async notifyAdRejected(userId: string, adId: string, adTitle: string, reason: string | null) {
    const notification = await this.prisma.notification.create({
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

    // В отличие от записи в БД выше (намеренно без try/catch — это
    // локальная база, падать не должна, и если упадёт, лучше явно увидеть
    // 500), письмо — внешний сервис, зависящий от сети/SMTP. Если оно не
    // отправится, продавец всё равно узнает через in-app уведомление
    // (только что созданное) — падать из-за письма и мешать самому
    // отклонению объявления не должны.
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      })

      // Email необязателен (можно зарегистрироваться только по телефону,
      // см. User.email в схеме) — тогда просто не отправляем письмо.
      if (user?.email) {
        await this.mailService.sendAdRejectedEmail(user.email, adId, adTitle, reason)
      }
    } catch (error) {
      this.logger.error(`Не удалось отправить письмо об отклонении объявления ${adId}`, error)
    }

    return notification
  }
}
