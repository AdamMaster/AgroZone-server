import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import { AdReportReason } from 'prisma/generated/enums'

export class CreateAdReportDto {
  @IsEnum(AdReportReason)
  reason!: AdReportReason

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string
}
