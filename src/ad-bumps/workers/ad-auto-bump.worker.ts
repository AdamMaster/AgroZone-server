import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { AdStatus } from '@/generated/prisma/client'

import { PrismaService } from '@/prisma/prisma.service'
import { isPremiumActive } from '@/premium/utils/is-premium-active.util'

// Общий фоновый воркер для ДВУХ платных механик сразу — платной услуги
// "Поднять объявление" (Ad.bumpServiceUntil, см. AdBumpsService) и
// премиум-аккаунта (User.premiumUntil, см. PremiumService). Обе дают один
// и тот же эффект — раз в сутки объявление снова становится "свежим"
// (bumpedAt = now), что двигает его в топ обычной сортировки
// (COALESCE(bumped_at, created_at) DESC в AdsService.findAll). Ничего
// больше не нужно: премиум автоматически будет обгонять разовую услугу,
// как только у той закончится bumpServiceUntil, — это уже гарантируется
// самой сортировкой, без отдельной "тиражной" логики.
//
// Специально ОДИН воркер на оба случая, а не два отдельных — сама
// проверка "нужно ли поднять" отличается только условием eligibility,
// действие (bumpedAt = now) одно и то же.
@Injectable()
export class AdAutoBumpWorker {
  private readonly logger = new Logger(AdAutoBumpWorker.name)

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 * * * *') // каждый час
  async handleAutoBump() {
    const now = new Date()
    // "Устарело" — bumpedAt пуст или ему больше ~24 часов. Проверяем раз в
    // час, а не раз в сутки, чтобы не собирать всех разом в одну и ту же
    // минуту — но реальный эффект для каждого объявления всё равно
    // получается "раз в районе суток".
    const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const candidates = await this.prisma.ad.findMany({
      where: {
        status: AdStatus.PUBLISHED,
        OR: [{ bumpedAt: null }, { bumpedAt: { lte: staleThreshold } }]
      },
      select: { id: true, bumpServiceUntil: true, user: { select: { premiumUntil: true } } }
    })

    // Prisma не даёт использовать один и тот же ключ OR дважды в одном
    // where, поэтому фильтр по eligibility (bumpServiceUntil ИЛИ
    // user.premiumUntil) делаем в приложении, а не в SQL — датасет
    // "устаревших PUBLISHED объявлений" в реальности небольшой, полный
    // прогон раз в час не проблема для текущих объёмов.
    const eligibleIds = candidates
      // ad.user типизирован как User | null (см. schema.prisma — на Ad
      // связь "user User? @relation(...)" при том что сам userId
      // обязателен, особенность схемы), поэтому ?. на всякий случай — по
      // факту для PUBLISHED-объявления пользователь всегда есть.
      .filter(ad => (ad.bumpServiceUntil && ad.bumpServiceUntil > now) || isPremiumActive(ad.user?.premiumUntil))
      .map(ad => ad.id)

    if (eligibleIds.length === 0) {
      return
    }

    const result = await this.prisma.ad.updateMany({
      where: { id: { in: eligibleIds } },
      data: { bumpedAt: now }
    })

    this.logger.log(`AdAutoBumpWorker: автоматически поднято объявлений: ${result.count}`)
  }
}
