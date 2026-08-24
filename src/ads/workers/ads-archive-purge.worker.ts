import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '@/prisma/prisma.service'
import { FileService } from '@/file/file.service'
import { AdStatus } from '@/generated/prisma/client'

// Физически удаляет объявления, лежащие в архиве (ARCHIVED) — вместе с их
// фотографиями в S3.
//
// Переписка по объявлению эту чистку больше не блокирует и не страдает от
// неё: Conversation.adId — nullable, onDelete SetNull (см. schema.prisma),
// так что удаление Ad просто обнуляет ссылку в диалоге, а не сносит его
// каскадом. Диалог живёт своей жизнью и удаляется отдельно, только когда
// оба его участника удалили аккаунты (см. UserService.deleteAccount).
//
// Два независимых источника архивации — и у каждого свой срок:
//
// 1. Владелец удалил аккаунт (User.deletedAt) — предупреждать/ждать больше
//    некого, почта уже обезличена, восстановить объявление он не сможет.
//    Искусственной задержки нет — такие объявления попадают в самую
//    ближайшую ночную чистку.
// 2. Живой пользователь заархивировал объявление сам (Ad.archivedAt) — он
//    может зайти и восстановить его из архива, поэтому даём ему 30 дней на
//    то, чтобы передумать (тот же срок, что у обычного объявления до
//    истечения, см. AdsService.getExpirationDateFrom).
@Injectable()
export class AdsArchivePurgeWorker {
  private readonly logger = new Logger(AdsArchivePurgeWorker.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService
  ) {}

  @Cron('0 3 * * *') // каждый день в 3:00
  async purgeArchivedAds() {
    const selfArchiveCutoff = new Date()
    selfArchiveCutoff.setDate(selfArchiveCutoff.getDate() - 30)

    const adsToPurge = await this.prisma.ad.findMany({
      where: {
        status: AdStatus.ARCHIVED,
        OR: [
          // Случай 1: аккаунт-владелец удалён — без задержки.
          { user: { deletedAt: { not: null } } },
          // Случай 2: живой аккаунт, объявление заархивировано 30+ дней назад.
          { archivedAt: { lte: selfArchiveCutoff }, user: { deletedAt: null } }
        ]
      },
      select: { id: true, images: true }
    })

    if (!adsToPurge.length) {
      return
    }

    this.logger.log(`Найдено ${adsToPurge.length} архивных объявлений на удаление`)

    for (const ad of adsToPurge) {
      try {
        if (ad.images?.length) {
          await Promise.all(ad.images.map(url => this.fileService.deleteFileByUrl(url)))
        }

        // Каскадом снесёт Favorite/AdReport/AdBump/AdServicePurchase этого
        // объявления — это осознанно. Conversation НЕ каскадит (SetNull),
        // переписка по объявлению переживает его удаление.
        await this.prisma.ad.delete({ where: { id: ad.id } })
      } catch (error) {
        // Одно проблемное объявление (например, файл в S3 уже не найден) не
        // должно останавливать очистку остальных — просто логируем и идём дальше.
        this.logger.error(`Не удалось удалить архивное объявление ${ad.id}`, error)
      }
    }
  }
}
