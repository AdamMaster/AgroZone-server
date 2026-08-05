import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common'

import { CurrentUser } from '@/auth/decorators/decorators/user.decorator'
import { AuthGuard } from '@/auth/guards/auth.guard'

import { AdReportsService } from './ad-reports.service'
import { CreateAdReportDto } from './dto/create-ad-report.dto'

// Отдельный от AdsController контроллер (как BlockedUsersController отдельно
// от ConversationsController) — жалобы концептуально не про CRUD объявления,
// а про модерацию, и в будущем сюда же добавится ручка для админки
// (просмотр/разбор жалоб), которая с самим AdsController никак не связана.
@Controller('ads/:adId/reports')
@UseGuards(AuthGuard)
export class AdReportsController {
  constructor(private readonly adReportsService: AdReportsService) {}

  @Post()
  create(
    @Param('adId', ParseUUIDPipe) adId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAdReportDto
  ) {
    return this.adReportsService.createReport(userId, adId, dto)
  }
}
