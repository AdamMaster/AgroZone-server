import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'

import { AdBumpsService } from './ad-bumps.service'

// Публичный урл — сюда стучится сама ЮKassa, без сессии/куки пользователя.
// Этот путь нужно указать в настройках магазина в личном кабинете ЮKassa
// (Настройки → HTTP-уведомления): https://<домен>/payments/yookassa/webhook.
// @SkipThrottle — глобальный лимитер (3 запроса/мин, см. AppModule) не
// должен резать легитимные повторные уведомления от ЮKassa.
@Controller('payments/yookassa')
@SkipThrottle()
export class YookassaWebhookController {
  constructor(private readonly adBumpsService: AdBumpsService) {}

  // 200 — на успешный разбор, включая "не наш платёж"/уже обработанный
  // (см. handleWebhook, это не ошибки). Если же перепроверка статуса в
  // самой ЮKassa не удалась (например, сеть), handleWebhook бросает
  // исключение — Nest ответит не-2xx, и ЮKassa повторит вебхук позже,
  // вместо того чтобы платёж навсегда завис в PENDING.
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() body: unknown) {
    await this.adBumpsService.handleWebhook(body)
  }
}
