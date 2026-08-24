import { IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { AdStatus } from '@/generated/prisma/enums'

export class FindMyAdsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20

  @IsOptional()
  @IsEnum(AdStatus)
  status?: AdStatus
}
