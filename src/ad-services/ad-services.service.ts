import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AdStatus } from '@/generated/prisma/client'
import { AdBadge, AdServicePurchaseStatus, AdServiceType } from '@/generated/prisma/enums'

import { PrismaService } from '@/prisma/prisma.service'

import { AD_SERVICE_DURATION_DAYS, AD_SERVICE_LABELS, AD_SERVICE_PRICES_KOPECKS } from './constants/ad-services.constants'

const YOOKASSA_API_URL = 'https://api.yookassa.ru/v3'

interface YookassaPayment {
  id: string
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled'
  confirmation?: { confirmation_url?: string }
}

// Единый чекаут для страницы "Поднять просмотры" — продавец выбирает
// любой набор из трёх услуг разом (см. AdServicePurchase), платит одним
// платежом. По структуре почти copy-paste AdBumpsService (тот же приём:
// перепроверка статуса платежа напрямую у ЮKassa, а не доверие вебхуку),
// разница только в том, что тут применяется НЕСКОЛЬКО эффектов за одну
// успешную оплату вместо одного.
@Injectable()
export class AdServicesService {
  private readonly logger = new Logger(AdServicesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  private get authHeader(): string {
    const shopId = this.configService.getOrThrow<string>('YOOKASSA_SHOP_ID')
    const secretKey = this.configService.getOrThrow<string>('YOOKASSA_SECRET_KEY')

    return 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64')
  }

  async createCheckout(adId: string, userId: string, services: AdServiceType[], badge?: AdBadge) {
    const ad = await this.prisma.ad.findFirst({ where: { id: adId, userId } })

    if (!ad) {
      throw new NotFoundException('Объявление не найдено')
    }

    if (ad.status !== AdStatus.PUBLISHED) {
      throw new ForbiddenException('Услуги продвижения доступны только для опубликованного объявления')
    }

    if (services.includes(AdServiceType.BADGE) && !badge) {
      throw new BadRequestException('Не выбран значок')
    }

    const amount = services.reduce((sum, service) => sum + AD_SERVICE_PRICES_KOPECKS[service], 0)

    const purchase = await this.prisma.adServicePurchase.create({
      data: { adId, userId, amount, services, badge: services.includes(AdServiceType.BADGE) ? badge : null }
    })

    // Та же схема, что и в AdBumpsService: ALLOWED_ORIGIN (фронтенд), а не
    // APPLICATION_URL (бэкенд) — см. комментарий там же.
    const returnUrl = `${this.configService.getOrThrow<string>('ALLOWED_ORIGIN')}/ads/${adId}?servicePurchase=${purchase.id}`

    const description = services
      .map(service => AD_SERVICE_LABELS[service])
      .join(', ')
      .slice(0, 128)

    let payment: YookassaPayment

    try {
      const response = await fetch(`${YOOKASSA_API_URL}/payments`, {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
          'Idempotence-Key': purchase.id
        },
        body: JSON.stringify({
          amount: { value: (purchase.amount / 100).toFixed(2), currency: 'RUB' },
          confirmation: { type: 'redirect', return_url: returnUrl },
          capture: true,
          description: description || 'Продвижение объявления',
          metadata: { adServicePurchaseId: purchase.id }
        })
      })

      if (!response.ok) {
        this.logger.error(`ЮKassa вернула ${response.status} при создании платежа для AdServicePurchase ${purchase.id}`)
        throw new InternalServerErrorException('Не удалось создать платёж')
      }

      payment = await response.json()
    } catch (error) {
      await this.prisma.adServicePurchase.update({
        where: { id: purchase.id },
        data: { status: AdServicePurchaseStatus.CANCELED }
      })
      throw error
    }

    await this.prisma.adServicePurchase.update({
      where: { id: purchase.id },
      data: { yookassaPaymentId: payment.id }
    })

    if (!payment.confirmation?.confirmation_url) {
      throw new InternalServerErrorException('ЮKassa не вернула ссылку на оплату')
    }

    return { confirmationUrl: payment.confirmation.confirmation_url, purchaseId: purchase.id }
  }

  async handleWebhook(body: unknown) {
    const paymentId = this.extractPaymentId(body)

    if (!paymentId) {
      return
    }

    await this.reconcilePayment(paymentId)
  }

  // Запасной путь без вебхука — см. AdBumpsService.checkStatus, тот же приём.
  async checkStatus(purchaseId: string, userId: string) {
    const purchase = await this.prisma.adServicePurchase.findFirst({ where: { id: purchaseId, userId } })

    if (!purchase) {
      throw new NotFoundException('Платёж не найден')
    }

    if (!purchase.yookassaPaymentId) {
      return purchase
    }

    return (await this.reconcilePayment(purchase.yookassaPaymentId)) ?? purchase
  }

  private async reconcilePayment(paymentId: string) {
    const purchase = await this.prisma.adServicePurchase.findUnique({ where: { yookassaPaymentId: paymentId } })

    if (!purchase || purchase.status !== AdServicePurchaseStatus.PENDING) {
      return purchase
    }

    const response = await fetch(`${YOOKASSA_API_URL}/payments/${paymentId}`, {
      headers: { Authorization: this.authHeader }
    })

    if (!response.ok) {
      this.logger.error(`Не удалось перепроверить платёж ${paymentId} в ЮKassa: ${response.status}`)
      throw new InternalServerErrorException('Не удалось перепроверить платёж')
    }

    const payment: YookassaPayment = await response.json()

    if (payment.status === 'succeeded') {
      return this.prisma.$transaction(async tx => {
        const ad = await tx.ad.findUniqueOrThrow({
          where: { id: purchase.adId },
          select: { bumpServiceUntil: true, priceHighlightUntil: true }
        })

        const now = new Date()
        const durationMs = AD_SERVICE_DURATION_DAYS * 24 * 60 * 60 * 1000

        // Каждая услуга из массива применяется к своему полю независимо —
        // "лесенкой" (продлевает от текущего значения, если оно ещё не
        // истекло) для поднятия и выделения цены, той же логикой, что и в
        // AdBumpsService/PremiumService. Значок — не лесенка, а замена
        // (см. комментарий в schema.prisma).
        const data: {
          bumpServiceUntil?: Date
          bumpedAt?: Date
          priceHighlightUntil?: Date
          badge?: AdBadge
          badgeUntil?: Date
        } = {}

        if (purchase.services.includes(AdServiceType.BUMP)) {
          const base = ad.bumpServiceUntil && ad.bumpServiceUntil > now ? ad.bumpServiceUntil : now
          data.bumpServiceUntil = new Date(base.getTime() + durationMs)
          // Мгновенный эффект, как и в AdBumpsService — не ждать
          // следующего прохода AdAutoBumpWorker.
          data.bumpedAt = now
        }

        if (purchase.services.includes(AdServiceType.PRICE_HIGHLIGHT)) {
          const base = ad.priceHighlightUntil && ad.priceHighlightUntil > now ? ad.priceHighlightUntil : now
          data.priceHighlightUntil = new Date(base.getTime() + durationMs)
        }

        if (purchase.services.includes(AdServiceType.BADGE) && purchase.badge) {
          data.badge = purchase.badge
          data.badgeUntil = new Date(now.getTime() + durationMs)
        }

        await tx.ad.update({ where: { id: purchase.adId }, data })

        return tx.adServicePurchase.update({
          where: { id: purchase.id },
          data: { status: AdServicePurchaseStatus.SUCCEEDED, paidAt: now }
        })
      })
    }

    if (payment.status === 'canceled') {
      return this.prisma.adServicePurchase.update({
        where: { id: purchase.id },
        data: { status: AdServicePurchaseStatus.CANCELED }
      })
    }

    return purchase
  }

  private extractPaymentId(body: unknown): string | undefined {
    if (typeof body !== 'object' || body === null || !('object' in body)) {
      return undefined
    }

    const paymentObject = (body as { object?: unknown }).object

    if (typeof paymentObject !== 'object' || paymentObject === null || !('id' in paymentObject)) {
      return undefined
    }

    const id = (paymentObject as { id?: unknown }).id

    return typeof id === 'string' ? id : undefined
  }
}
