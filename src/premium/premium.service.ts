import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AdStatus } from '@/generated/prisma/client'
import { PremiumPurchaseStatus } from '@/generated/prisma/enums'

import { PrismaService } from '@/prisma/prisma.service'

import { PREMIUM_DURATION_DAYS, PREMIUM_PRICE_KOPECKS } from './constants/premium.constants'

const YOOKASSA_API_URL = 'https://api.yookassa.ru/v3'

interface YookassaPayment {
  id: string
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled'
  confirmation?: { confirmation_url?: string }
}

@Injectable()
export class PremiumService {
  private readonly logger = new Logger(PremiumService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  private get authHeader(): string {
    const shopId = this.configService.getOrThrow<string>('YOOKASSA_SHOP_ID')
    const secretKey = this.configService.getOrThrow<string>('YOOKASSA_SECRET_KEY')

    return 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64')
  }

  // Разовая покупка премиум-статуса на PREMIUM_DURATION_DAYS дней — тот же
  // паттерн, что и AdBumpsService.createCheckout (см. там подробные
  // комментарии). Само повышение (User.premiumUntil) происходит только по
  // факту подтверждённой оплаты, см. reconcilePayment.
  //
  // isRecurring/yookassaPaymentMethodId в PremiumPurchase сейчас всегда
  // false/null — это задел под будущее автосписание на проде (ЮKassa не
  // даёт тестировать рекуррент в тестовом магазине), в этом чекауте
  // намеренно не используется.
  async createCheckout(userId: string) {
    const purchase = await this.prisma.premiumPurchase.create({
      data: { userId, amount: PREMIUM_PRICE_KOPECKS }
    })

    // ?purchase=<id> — чтобы страница профиля при возврате с оплаты знала,
    // какой платёж перепроверить (см. checkStatus/premium.controller.ts).
    const returnUrl = `${this.configService.getOrThrow<string>('ALLOWED_ORIGIN')}/profile/settings/premium?purchase=${purchase.id}`

    let payment: YookassaPayment

    try {
      const response = await fetch(`${YOOKASSA_API_URL}/payments`, {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
          // Свой ключ идемпотентности на каждую НОВУЮ попытку оплаты (id
          // самой записи PremiumPurchase) — см. AdBumpsService.createCheckout
          // для подробного объяснения, тут ровно та же причина.
          'Idempotence-Key': purchase.id
        },
        body: JSON.stringify({
          amount: { value: (purchase.amount / 100).toFixed(2), currency: 'RUB' },
          confirmation: { type: 'redirect', return_url: returnUrl },
          capture: true,
          description: `Премиум-аккаунт на ${PREMIUM_DURATION_DAYS} дней`,
          metadata: { premiumPurchaseId: purchase.id }
        })
      })

      if (!response.ok) {
        this.logger.error(`ЮKassa вернула ${response.status} при создании платежа для PremiumPurchase ${purchase.id}`)
        throw new InternalServerErrorException('Не удалось создать платёж')
      }

      payment = await response.json()
    } catch (error) {
      // Платёж не создался — не оставляем "зависшую" PENDING-запись без
      // шанса на оплату, помечаем попытку отменённой сразу.
      await this.prisma.premiumPurchase.update({
        where: { id: purchase.id },
        data: { status: PremiumPurchaseStatus.CANCELED }
      })
      throw error
    }

    await this.prisma.premiumPurchase.update({
      where: { id: purchase.id },
      data: { yookassaPaymentId: payment.id }
    })

    if (!payment.confirmation?.confirmation_url) {
      throw new InternalServerErrorException('ЮKassa не вернула ссылку на оплату')
    }

    return { confirmationUrl: payment.confirmation.confirmation_url, purchaseId: purchase.id }
  }

  // Вызывается на вебхук от ЮKassa — см. YookassaWebhookController
  // (payments/yookassa/webhook, лежит в ad-bumps/, но общий на все виды
  // платежей магазина). Тот же принцип, что и в AdBumpsService: телу
  // запроса не доверяем, статус переспрашиваем напрямую у ЮKassa своим
  // секретным ключом.
  async handleWebhook(body: unknown) {
    const paymentId = this.extractPaymentId(body)

    if (!paymentId) {
      return
    }

    await this.reconcilePayment(paymentId)
  }

  // Запасной путь без вебхука (локальная разработка без публичного домена
  // + подстраховка на проде) — см. AdBumpsService.checkStatus, причина та
  // же самая.
  async checkStatus(purchaseId: string, userId: string) {
    const purchase = await this.prisma.premiumPurchase.findFirst({ where: { id: purchaseId, userId } })

    if (!purchase) {
      throw new NotFoundException('Платёж не найден')
    }

    if (!purchase.yookassaPaymentId) {
      return purchase
    }

    return (await this.reconcilePayment(purchase.yookassaPaymentId)) ?? purchase
  }

  // Общая часть для handleWebhook и checkStatus — перепроверяет статус
  // платежа напрямую у ЮKassa и применяет его. В отличие от
  // AdBumpsService.reconcilePayment, при успехе продлевает
  // User.premiumUntil СВЕРХ текущего значения, если премиум уже активен
  // (а не перезаписывает его текущей датой) — чтобы повторная покупка до
  // истечения текущего периода не "сжигала" уже оплаченные дни. Ничего не
  // делает, если платёж уже был обработан раньше (см. AdBumpsService для
  // объяснения, почему это важно — оба вызывающих пути могут сработать
  // больше одного раза на один и тот же платёж).
  private async reconcilePayment(paymentId: string) {
    const purchase = await this.prisma.premiumPurchase.findUnique({ where: { yookassaPaymentId: paymentId } })

    if (!purchase || purchase.status !== PremiumPurchaseStatus.PENDING) {
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
        const user = await tx.user.findUniqueOrThrow({
          where: { id: purchase.userId },
          select: { premiumUntil: true }
        })

        const now = new Date()
        // Продление "сверху": если премиум ещё не истёк, считаем от
        // текущего premiumUntil, а не от now — иначе купленные, но ещё не
        // использованные дни просто сгорали бы.
        const base = user.premiumUntil && user.premiumUntil > now ? user.premiumUntil : now
        const premiumUntil = new Date(base.getTime() + PREMIUM_DURATION_DAYS * 24 * 60 * 60 * 1000)

        await tx.user.update({ where: { id: purchase.userId }, data: { premiumUntil } })

        // Мгновенный эффект в момент покупки — поднимаем ВСЕ опубликованные
        // объявления пользователя сразу, не дожидаясь ближайшего прохода
        // AdAutoBumpWorker (который дальше уже сам будет держать их
        // свежими всё время, пока премиум активен, см. сам воркер).
        await tx.ad.updateMany({
          where: { userId: purchase.userId, status: AdStatus.PUBLISHED },
          data: { bumpedAt: now }
        })

        return tx.premiumPurchase.update({
          where: { id: purchase.id },
          data: { status: PremiumPurchaseStatus.SUCCEEDED, paidAt: now }
        })
      })
    }

    if (payment.status === 'canceled') {
      return this.prisma.premiumPurchase.update({
        where: { id: purchase.id },
        data: { status: PremiumPurchaseStatus.CANCELED }
      })
    }

    // pending/waiting_for_capture — статус в ЮKassa ещё не финальный,
    // ничего не меняем, ждём следующей проверки.
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
