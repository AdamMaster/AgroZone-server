import { IsEnum } from 'class-validator'
import { AdReportStatus } from '@/generated/prisma/enums'

export class UpdateAdReportStatusDto {
  @IsEnum(AdReportStatus)
  status!: AdReportStatus
}
