import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common'
import { UserRole } from '@/generated/prisma/enums'

import { Roles } from '@/auth/decorators/roles.decorator'
import { AuthGuard } from '@/auth/guards/auth.guard'
import { RolesGuard } from '@/auth/guards/roles.guard'

import { AdReportsService } from './ad-reports.service'
import { UpdateAdReportStatusDto } from './dto/update-ad-report-status.dto'

// Отдельный от AdReportsController контроллер (тот занят созданием жалобы
// по конкретному объявлению, ads/:adId/reports) — здесь список ВСЕХ жалоб
// сразу, по всем объявлениям, доступный только модератору.
@Controller('ad-reports')
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class AdReportsAdminController {
  constructor(private readonly adReportsService: AdReportsService) {}

  @Get()
  findAll() {
    return this.adReportsService.findAll()
  }

  @Patch(':id')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAdReportStatusDto) {
    return this.adReportsService.updateStatus(id, dto.status)
  }
}
