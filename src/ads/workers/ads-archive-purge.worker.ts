import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '@/prisma/prisma.service'
import { FileService } from '@/file/file.service'
import { AdStatus } from 'prisma/generated/client'

// Физически удаляет объявления, пролежавшие в архиве (ARCHIVED) дольше 30
// дней — вместе с их фотографиями в S3.
//
// Осознанно удаляем именно строку целиком, а не только фото. Conversation
// каскадно завязан на Ad (onDelete: Cascade, см. schema.prisma) — то есть
// удаление объявления сносит и переписку по нему, включая сообщения
// собеседника, который ничего не удалял. Это НЕ побочный эффект, который
// не заметили, а сознательное решение: те же 30 дней, что дают
// удалённому/архивированному объявлению, служат и окном на переписку —
// собеседник успевает её увидеть и сохранить нужное, а после — она уходит
// вместе с объявлением, как и всё остальное, что с ним связано (Favorite,
// AdReport и т.д. — тоже каскадом). Хранить вечно тощую строку объявления
// ради теоретической переписки, которую никто не откроет, признано
// избыточным — 30 дней уже достаточно щедрый срок (столько же, кстати,
// живёт обычное опубликованное объявление до истечения, см.
// AdsService.getExpirationDateFrom).
//
// Два независимых источника отсчёта этих 30 дней (см. комментарии у
// User.deletedAt и Ad.archivedAt в schema.prisma):
//
// 1. Владелец удалил аккаунт — считаем от User.deletedAt. Такие объявления
//    точно никто не оживит, предупреждать некого (почта уже обезличена).
// 2. Живой пользователь заархивировал объявление сам — считаем от
//    Ad.archivedAt. Он теоретически может зайти и восстановить объявление
//    из архива, поэтому это не должно случиться раньше согласованных 30 дней.
@Injectable()
export class AdsArchivePurgeWorker {
  private readonly logger = new Logger(AdsArchivePurgeWorker.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService
  ) {}

  @Cron('0 3 * * *') // каждый день в 3:00
  async purgeArchivedAds() {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)

    const adsToPurge = await this.prisma.ad.findMany({
      where: {
        status: AdStatus.ARCHIVED,
        OR: [
          // Случай 1: аккаунт удалён 30+ дней назад
          { user: { deletedAt: { lte: cutoff } } },
          // Случай 2: живой аккаунт, объявление заархивировано 30+ дней назад
          { archivedAt: { lte: cutoff }, user: { deletedAt: null } }
        ]
      },
      select: { id: true, images: true }
    })

    if (!adsToPurge.length) {
      return
    }

    this.logger.log(`Найдено ${adsToPurge.length} архивных объявлений старше 30 дней — удаляю`)

    for (const ad of adsToPurge) {
      try {
        if (ad.images?.length) {
          await Promise.all(ad.images.map(url => this.fileService.deleteFileByUrl(url)))
        }

        // Удаляет и связанные Conversation/Message/Favorite/AdReport и т.д.
        // каскадом — см. комментарий к классу, это осознанно.
        await this.prisma.ad.delete({ where: { id: ad.id } })
      } catch (error) {
        // Одно проблемное объявление (например, файл в S3 уже не найден) не
        // должно останавливать очистку остальных — просто логируем и идём дальше.
        this.logger.error(`Не удалось удалить архивное объявление ${ad.id}`, error)
      }
    }
  }
}
