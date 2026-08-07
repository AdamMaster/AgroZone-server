import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common'

import { CurrentUser } from '@/auth/decorators/decorators/user.decorator'
import { AuthGuard } from '@/auth/guards/auth.guard'

import { PremiumService } from './premium.service'

// userId берётся из сессии (@CurrentUser), а не из урла — в отличие от
// AdBumpsController тут нет отдельного ресурса-владельца, покупка всегда
// "про себя".
@Controller('premium')
export class PremiumController {
  constructor(private readonly premiumService: PremiumService) {}

  @Post('checkout')
  @UseGuards(AuthGuard)
  createCheckout(@CurrentUser('id') userId: string) {
    return this.premiumService.createCheckout(userId)
  }

  // Ручная перепроверка статуса оплаты — без вебхука/ngrok, см.
  // AdBumpsController.checkStatus для подробностей.
  @Get(':purchaseId/status')
  @UseGuards(AuthGuard)
  checkStatus(@Param('purchaseId', ParseUUIDPipe) purchaseId: string, @CurrentUser('id') userId: string) {
    return this.premiumService.checkStatus(purchaseId, userId)
  }
}
