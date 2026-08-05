import { BadRequestException, Injectable } from '@nestjs/common'

import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class BlockedUsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Список тех, кого заблокировал текущий юзер — для экрана
  // "Заблокированные" в настройках, с возможностью разблокировать.
  async getBlockedUsers(blockerId: string) {
    const rows = await this.prisma.blockedUser.findMany({
      where: { blockerId },
      orderBy: { createdAt: 'desc' },
      include: { blocked: { select: { id: true, displayName: true, picture: true } } }
    })

    return rows.map(row => ({
      id: row.blocked.id,
      displayName: row.blocked.displayName,
      picture: row.blocked.picture,
      blockedAt: row.createdAt
    }))
  }

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('Нельзя заблокировать самого себя')
    }

    // upsert — повторная блокировка уже заблокированного юзера просто
    // ничего не делает, а не падает ошибкой уникальности.
    await this.prisma.blockedUser.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId }
    })

    // Прячем у блокирующего все существующие диалоги с этим человеком сразу
    // по всем объявлениям — блокировка глобальная, а не по одному диалогу
    // (см. комментарий к модели BlockedUser). Два отдельных updateMany,
    // потому что то, какой флаг скрытия относится к блокирующему
    // (hiddenByBuyer или hiddenBySeller), зависит от его роли в конкретном
    // диалоге и может отличаться от диалога к диалогу.
    await this.prisma.$transaction([
      this.prisma.conversation.updateMany({
        where: { buyerId: blockerId, sellerId: blockedId },
        data: { hiddenByBuyer: true }
      }),
      this.prisma.conversation.updateMany({
        where: { sellerId: blockerId, buyerId: blockedId },
        data: { hiddenBySeller: true }
      })
    ])
  }

  // deleteMany, а не delete по уникальному ключу — идемпотентно: повторная
  // разблокировка (или разблокировка того, кого и не блокировали) не должна
  // падать 404.
  //
  // Заодно возвращаем в список диалоги, которые скрылись именно из-за
  // блокировки (см. blockUser выше) — иначе разблокировка выглядела бы так,
  // будто ничего не изменилось: писать снова можно, а диалог в списке так и
  // не появляется. Компромисс: если диалог был скрыт вручную через "Удалить
  // переписку" ДО блокировки, он тоже вернётся — отдельного флага, откуда
  // именно взялось скрытие, в схеме нет. Ради предсказуемого поведения
  // ("разблокировал — эффект блокировки полностью снят") это осознанно
  // принимаем.
  async unblockUser(blockerId: string, blockedId: string) {
    await this.prisma.$transaction([
      this.prisma.blockedUser.deleteMany({ where: { blockerId, blockedId } }),
      this.prisma.conversation.updateMany({
        where: { buyerId: blockerId, sellerId: blockedId },
        data: { hiddenByBuyer: false }
      }),
      this.prisma.conversation.updateMany({
        where: { sellerId: blockerId, buyerId: blockedId },
        data: { hiddenBySeller: false }
      })
    ])
  }

  // Проверяется перед стартом диалога и перед каждым сообщением — блокировка
  // в любую сторону между собеседниками запрещает переписку: если продавец
  // заблокировал покупателя, покупатель всё равно не должен иметь возможность
  // ему написать (и наоборот).
  async isBlocked(userIdA: string, userIdB: string): Promise<boolean> {
    const count = await this.prisma.blockedUser.count({
      where: {
        OR: [
          { blockerId: userIdA, blockedId: userIdB },
          { blockerId: userIdB, blockedId: userIdA }
        ]
      }
    })

    return count > 0
  }
}
