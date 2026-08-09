import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common'

import { CurrentUser } from '@/auth/decorators/decorators/user.decorator'
import { AuthGuard } from '@/auth/guards/auth.guard'

import { AdServicesService } from './ad-services.service'
import { CreateAdServiceCheckoutDto } from './dto/create-checkout.dto'

// adId в урле, сумма всегда считается сервером из выбранных services — от
// клиента цена не принимается (см. AdServicesService.createCheckout).
@Controller('ads/:adId/services')
export class AdServicesController {
  constructor(private readonly adServicesService: AdServicesService) {}

  @Post('checkout')
  @UseGuards(AuthGuard)
  createCheckout(
    @Param('adId', ParseUUIDPipe) adId: string,
    @CurrentUser('id') userId: string,
    @Body() { services, badge }: CreateAdServiceCheckoutDto
  ) {
    return this.adServicesService.createCheckout(adId, userId, services, badge)
  }

  // Ручная перепроверка без вебхука — см. AdBumpsController, тот же приём.
  @Get(':purchaseId/status')
  @UseGuards(AuthGuard)
  checkStatus(@Param('purchaseId', ParseUUIDPipe) purchaseId: string, @CurrentUser('id') userId: string) {
    return this.adServicesService.checkStatus(purchaseId, userId)
  }
}
