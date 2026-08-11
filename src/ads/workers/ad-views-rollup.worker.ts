import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '@/prisma/prisma.service'

// Сворачивает сырые AdView (по одной записи на посетителя в день, см.
// schema.prisma) в дневные суммы AdViewDaily — раз в сутки, тот же паттерн,
// что AdsExpirationWorker/AdsArchivePurgeWorker.
//
// Трогаем только дни СТРОГО до сегодняшнего — за сегодня данные ещё
// копятся (AdsService.recordView продолжает писать в AdView весь день), и
// если свернуть их раньше времени, часть сегодняшних просмотров потеряется
// или задвоится при следующем прогоне. Живая статистика за сегодня
// досчитывается на лету при чтении (см. AdsService.getViewStats), а не
// здесь.
//
// Апсерт в AdViewDaily и удаление уже свёрнутых строк из AdView — одной
// транзакцией на каждую группу (adId, date): если воркер упадёт посреди
// прогона, уже закоммиченные группы не задвоятся при следующем запуске,
// пересчитаются только те, что не успели обработать.
@Injectable()
export class AdViewsRollupWorker {
  private readonly logger = new Logger(AdViewsRollupWorker.name)

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 2 * * *') // каждый день в 2:00 — до архивной чистки в 3:00
  async rollupViews() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const staleViews = await this.prisma.adView.findMany({
      where: { viewDate: { lt: today } },
      select: { id: true, adId: true, viewDate: true }
    })

    if (!staleViews.length) {
      return
    }

    const groups = new Map<string, { adId: string; date: Date; viewIds: string[] }>()

    for (const view of staleViews) {
      const key = `${view.adId}|${view.viewDate.toISOString()}`
      const group = groups.get(key)

      if (group) {
        group.viewIds.push(view.id)
      } else {
        groups.set(key, { adId: view.adId, date: view.viewDate, viewIds: [view.id] })
      }
    }

    this.logger.log(`Сворачиваю ${staleViews.length} просмотров в ${groups.size} дневных записей`)

    for (const { adId, date, viewIds } of groups.values()) {
      try {
        await this.prisma.$transaction([
          this.prisma.adViewDaily.upsert({
            where: { adId_date: { adId, date } },
            create: { adId, date, views: viewIds.length },
            update: { views: { increment: viewIds.length } }
          }),
          this.prisma.adView.deleteMany({ where: { id: { in: viewIds } } })
        ])
      } catch (error) {
        // Одна проблемная группа не должна останавливать сворачивание
        // остальных — просто логируем и идём дальше, при следующем прогоне
        // не свёрнутые строки попробуются снова.
        this.logger.error(`Не удалось свернуть просмотры объявления ${adId} за ${date.toISOString()}`, error)
      }
    }
  }
}
