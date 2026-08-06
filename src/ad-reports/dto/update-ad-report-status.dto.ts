import { IsEnum } from 'class-validator'
import { AdReportStatus } from 'prisma/generated/enums'

export class UpdateAdReportStatusDto {
  @IsEnum(AdReportStatus)
  status!: AdReportStatus
}
