import { ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AdStatus } from 'prisma/generated/client'
import { AdBumpStatus } from 'prisma/generated/enums'

import { PrismaService } from '@/prisma/prisma.service'

import { AD_BUMP_PRICE_KOPECKS } from './constants/ad-bumps.constants'

const YOOKASSA_API_URL = 'https://api.yookassa.ru/v3'

interface YookassaPayment {
  id: string
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled'
  confirmation?: { confirmation_url?: string }
}

@Injectable()
export class AdBumpsService {
  private readonly logger = new Logger(AdBumpsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  private get authHeader(): string {
    const shopId = this.configService.getOrThrow<string>('YOOKASSA_SHOP_ID')
    const secretKey = this.configService.getOrThrow<string>('YOOKASSA_SECRET_KEY')

    return 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64')
  }

  // Создаёт запись о попытке поднятия и платёж в ЮKassa, возвращает ссылку,
  // на которую нужно отправить пользователя для оплаты. Само поднятие
  // (Ad.bumpedAt) происходит только по факту подтверждённой оплаты — см.
  // handleWebhook.
  async createCheckout(adId: string, userId: string) {
    const ad = await this.prisma.ad.findFirst({ where: { id: adId, userId } })

    if (!ad) {
      throw new NotFoundException('Объявление не найдено')
    }

    if (ad.status !== AdStatus.PUBLISHED) {
      throw new ForbiddenException('Поднять можно только опубликованное объявление')
    }

    const bump = await this.prisma.adBump.create({
      data: { adId, userId, amount: AD_BUMP_PRICE_KOPECKS }
    })

    const returnUrl = `${this.configService.getOrThrow<string>('APPLICATION_URL')}/ads/${adId}`

    let payment: YookassaPayment

    try {
      const response = await fetch(`${YOOKASSA_API_URL}/payments`, {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
          // Свой ключ идемпотентности на каждую НОВУЮ попытку оплаты (id
          // самой записи AdBump) — если клиент случайно продублирует
          // запрос, ЮKassa не создаст два разных платежа на один и тот же
          // AdBump. Ключ обязателен на каждый POST /payments по правилам
          // ЮKassa, поэтому используем bump.id, а не отдельный uuid — так
          // повторный вызов createCheckout для НОВОЙ попытки поднятия
          // гарантированно получит новый ключ (новый bump.id).
          'Idempotence-Key': bump.id
        },
        body: JSON.stringify({
          amount: { value: (bump.amount / 100).toFixed(2), currency: 'RUB' },
          confirmation: { type: 'redirect', return_url: returnUrl },
          capture: true,
          description: `Поднятие объявления «${ad.title}»`.slice(0, 128),
          metadata: { adBumpId: bump.id }
        })
      })

      if (!response.ok) {
        this.logger.error(`ЮKassa вернула ${response.status} при создании платежа для AdBump ${bump.id}`)
        throw new InternalServerErrorException('Не удалось создать платёж')
      }

      payment = await response.json()
    } catch (error) {
      // Платёж не создался — не оставляем "зависший" PENDING без шанса на
      // оплату, помечаем попытку отменённой сразу.
      await this.prisma.adBump.update({ where: { id: bump.id }, data: { status: AdBumpStatus.CANCELED } })
      throw error
    }

    await this.prisma.adBump.update({
      where: { id: bump.id },
      data: { yookassaPaymentId: payment.id }
    })

    if (!payment.confirmation?.confirmation_url) {
      throw new InternalServerErrorException('ЮKassa не вернула ссылку на оплату')
    }

    return { confirmationUrl: payment.confirmation.confirmation_url, bumpId: bump.id }
  }

  // Вызывается на каждый вебхук от ЮKassa. Намеренно НЕ доверяет статусу из
  // тела запроса (его в теории можно подделать, отправив POST на этот же
  // урл с произвольным телом) — вместо этого перезапрашивает платёж по id
  // напрямую у ЮKassa своим секретным ключом и верит только этому ответу
  // (см. reconcilePayment).
  async handleWebhook(body: unknown) {
    const paymentId = this.extractPaymentId(body)

    if (!paymentId) {
      return
    }

    await this.reconcilePayment(paymentId)
  }

  // Запасной путь без вебхука — для локальной разработки (когда вебхуку
  // неоткуда достучаться до localhost) и как подстраховка на проде на
  // случай, если сам вебхук по какой-то причине не дошёл или опоздал.
  // Дёргается вручную (например, со страницы возврата после оплаты —
  // return_url из createCheckout) и идёт по тому же самому пути проверки,
  // что и вебхук: перезапрашивает статус напрямую у ЮKassa, а не верит
  // тому, что ей "должно было прийти".
  async checkStatus(adId: string, bumpId: string, userId: string) {
    const bump = await this.prisma.adBump.findFirst({ where: { id: bumpId, adId, userId } })

    if (!bump) {
      throw new NotFoundException('Платёж не найден')
    }

    if (!bump.yookassaPaymentId) {
      // createCheckout ещё не успел записать yookassaPaymentId (см. код
      // там) — с точки зрения клиента это тоже "ещё не оплачено".
      return bump
    }

    return (await this.reconcilePayment(bump.yookassaPaymentId)) ?? bump
  }

  // Общая часть для handleWebhook и checkStatus: перезапрашивает статус
  // платежа НАПРЯМУЮ у ЮKassa (не доверяя ничему, что пришло со стороны) и
  // применяет его — поднимает объявление при успехе, отменяет попытку при
  // отмене. Ничего не делает, если платёж уже был обработан раньше (оба
  // вызывающих пути могут сработать больше одного раза на один и тот же
  // платёж — вебхук может продублироваться, checkStatus можно дёрнуть
  // повторно вручную).
  private async reconcilePayment(paymentId: string) {
    const bump = await this.prisma.adBump.findUnique({ where: { yookassaPaymentId: paymentId } })

    if (!bump || bump.status !== AdBumpStatus.PENDING) {
      return bump
    }

    const response = await fetch(`${YOOKASSA_API_URL}/payments/${paymentId}`, {
      headers: { Authorization: this.authHeader }
    })

    if (!response.ok) {
      this.logger.error(`Не удалось перепроверить платёж ${paymentId} в ЮKassa: ${response.status}`)
      // Бросаем, а не тихо выходим: вызывающая сторона (контроллер вебхука
      // или checkStatus) должна узнать, что проверка не удалась, а не
      // молча решить, что платёж всё ещё PENDING.
      throw new InternalServerErrorException('Не удалось перепроверить платёж')
    }

    const payment: YookassaPayment = await response.json()

    if (payment.status === 'succeeded') {
      const [updatedBump] = await this.prisma.$transaction([
        this.prisma.adBump.update({
          where: { id: bump.id },
          data: { status: AdBumpStatus.SUCCEEDED, paidAt: new Date() }
        }),
        this.prisma.ad.update({
          where: { id: bump.adId },
          data: { bumpedAt: new Date() }
        })
      ])

      return updatedBump
    }

    if (payment.status === 'canceled') {
      return this.prisma.adBump.update({
        where: { id: bump.id },
        data: { status: AdBumpStatus.CANCELED }
      })
    }

    // pending/waiting_for_capture — статус в ЮKassa ещё не финальный,
    // ничего не меняем, ждём следующей проверки.
    return bump
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
