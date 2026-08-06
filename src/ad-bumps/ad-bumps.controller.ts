import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common'

import { CurrentUser } from '@/auth/decorators/decorators/user.decorator'
import { AuthGuard } from '@/auth/guards/auth.guard'

import { AdBumpsService } from './ad-bumps.service'

// adId в урле, а не в теле — сумма платежа всегда берётся сервером
// (AD_BUMP_PRICE_KOPECKS), от клиента не принимается ничего, что влияло бы
// на цену.
@Controller('ads/:adId/bump')
export class AdBumpsController {
  constructor(private readonly adBumpsService: AdBumpsService) {}

  @Post('checkout')
  @UseGuards(AuthGuard)
  createCheckout(@Param('adId', ParseUUIDPipe) adId: string, @CurrentUser('id') userId: string) {
    return this.adBumpsService.createCheckout(adId, userId)
  }

  // Ручная перепроверка статуса оплаты — без вебхука/ngrok. Дергается,
  // например, со страницы возврата после оплаты (return_url ведёт на
  // localhost, куда сама ЮKassa достучаться не может).
  @Get(':bumpId/status')
  @UseGuards(AuthGuard)
  checkStatus(
    @Param('adId', ParseUUIDPipe) adId: string,
    @Param('bumpId', ParseUUIDPipe) bumpId: string,
    @CurrentUser('id') userId: string
  ) {
    return this.adBumpsService.checkStatus(adId, bumpId, userId)
  }
}
