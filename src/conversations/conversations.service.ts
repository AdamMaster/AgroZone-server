import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'

import { BlockedUsersService } from '@/blocked-users/blocked-users.service'
import { PrismaService } from '@/prisma/prisma.service'

import { FindMessagesQueryDto } from './dto/find-messages-query.dto'
import { SendMessageDto } from './dto/send-message.dto'
import { StartConversationDto } from './dto/start-conversation.dto'

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockedUsersService: BlockedUsersService
  ) {}

  // Начать диалог с продавцом объявления. Всегда вызывается покупателем —
  // sellerId берём из самого объявления, а не из тела запроса, чтобы нельзя
  // было подменить продавца. Повторное обращение того же покупателя к тому
  // же объявлению не плодит новый диалог (см. @@unique([adId, buyerId]) в
  // схеме) — upsert просто найдёт существующий и добавит туда сообщение.
  async startConversation(userId: string, dto: StartConversationDto) {
    const ad = await this.prisma.ad.findUnique({
      where: { id: dto.adId },
      select: { id: true, userId: true }
    })

    if (!ad) {
      throw new NotFoundException('Объявление не найдено')
    }

    if (ad.userId === userId) {
      throw new BadRequestException('Нельзя написать самому себе')
    }

    // Сообщение об ошибке намеренно нейтральное, без слова "заблокировал" —
    // не сообщаем прямо, что именно произошла блокировка (см. обсуждение UX
    // блокировки), чтобы не провоцировать конфликт в интерфейсе.
    if (await this.blockedUsersService.isBlocked(userId, ad.userId)) {
      throw new ForbiddenException('Не удалось отправить сообщение')
    }

    const conversation = await this.prisma.conversation.upsert({
      where: { adId_buyerId: { adId: dto.adId, buyerId: userId } },
      update: {},
      create: { adId: dto.adId, buyerId: userId, sellerId: ad.userId }
    })

    const message = await this.createMessage(conversation.id, userId, dto.text)

    return { conversation, message }
  }

  async sendMessage(conversationId: string, userId: string, dto: SendMessageDto) {
    const conversation = await this.getConversationForParticipant(conversationId, userId)
    const counterpartId = conversation.buyerId === userId ? conversation.sellerId : conversation.buyerId

    if (await this.blockedUsersService.isBlocked(userId, counterpartId)) {
      throw new ForbiddenException('Не удалось отправить сообщение')
    }

    return this.createMessage(conversationId, userId, dto.text, dto.attachments)
  }

  // Список диалогов текущего юзера — и как покупателя, и как продавца
  // сразу, отсортированный по свежести последнего сообщения. Для каждого
  // диалога отдаём "собеседника" (не "юзер А и юзер Б", а именно того, кто
  // не текущий юзер) и посчитанный на лету isUnread — сравнением времени
  // последнего сообщения с курсором прочтения текущего юзера, без отдельной
  // таблицы статусов (см. комментарий к модели Conversation в schema.prisma).
  async getConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      // hiddenBy* — диалог, который этот юзер у себя "удалил" (см. комментарий
      // в schema.prisma), просто не попадает в список; для второго участника
      // условие на его собственный флаг не срабатывает, и у него диалог
      // остаётся видимым как ни в чём не бывало.
      where: {
        OR: [
          { buyerId: userId, hiddenByBuyer: false },
          { sellerId: userId, hiddenBySeller: false }
        ]
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        ad: { select: { id: true, title: true, images: true, slug: true } },
        buyer: { select: { id: true, displayName: true, picture: true } },
        seller: { select: { id: true, displayName: true, picture: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 }
      }
    })

    return conversations.map(conversation => {
      const isBuyer = conversation.buyerId === userId
      const counterpart = isBuyer ? conversation.seller : conversation.buyer
      const lastReadAt = isBuyer ? conversation.buyerLastReadAt : conversation.sellerLastReadAt
      const lastMessage = conversation.messages[0] ?? null

      return {
        id: conversation.id,
        ad: conversation.ad,
        counterpart,
        lastMessage,
        dealConfirmed: conversation.dealConfirmed,
        // Своё же сообщение не считается непрочитанным.
        isUnread: !!lastMessage && lastMessage.senderId !== userId && (!lastReadAt || lastMessage.createdAt > lastReadAt),
        updatedAt: conversation.lastMessageAt ?? conversation.createdAt
      }
    })
  }

  async getMessages(conversationId: string, userId: string, query: FindMessagesQueryDto) {
    await this.getConversationForParticipant(conversationId, userId)

    const limit = query.limit ?? 30

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(query.cursor && { createdAt: { lt: new Date(query.cursor) } })
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    // Из базы читаем от новых к старым (удобно для LIMIT), а отдаём в
    // хронологическом порядке — фронту так проще рендерить список сверху вниз.
    return messages.reverse()
  }

  async markRead(conversationId: string, userId: string) {
    const conversation = await this.getConversationForParticipant(conversationId, userId)
    const isBuyer = conversation.buyerId === userId

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: isBuyer ? { buyerLastReadAt: new Date() } : { sellerLastReadAt: new Date() }
    })
  }

  // "Удаление" диалога из списка — скрывает его только у того, кто нажал
  // удалить (см. комментарий к hiddenByBuyer/hiddenBySeller в schema.prisma).
  // У второго участника переписка остаётся как есть.
  async deleteConversation(conversationId: string, userId: string) {
    const conversation = await this.getConversationForParticipant(conversationId, userId)
    const isBuyer = conversation.buyerId === userId

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: isBuyer ? { hiddenByBuyer: true } : { hiddenBySeller: true }
    })
  }

  private async createMessage(conversationId: string, senderId: string, text: string, attachments: string[] = []) {
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({ data: { conversationId, senderId, text, attachments } }),
      // Сбрасываем скрытие с обеих сторон при любом новом сообщении — не
      // только у получателя (которому логично снова увидеть диалог, раз ему
      // пишут), но и у самого отправителя: если он писал через "Написать" на
      // странице объявления в диалог, который сам же раньше скрыл, он должен
      // увидеть в списке своё же новое сообщение, а не потерять его.
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date(), hiddenByBuyer: false, hiddenBySeller: false }
      })
    ])

    return message
  }

  private async getConversationForParticipant(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } })

    if (!conversation) {
      throw new NotFoundException('Диалог не найден')
    }

    if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
      throw new ForbiddenException('Это не ваш диалог')
    }

    return conversation
  }
}
