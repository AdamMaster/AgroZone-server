import { PartialType } from '@nestjs/mapped-types'
import { CreateAdDto } from './create-ad.dto'
import { IsOptional } from 'class-validator'
import { Prisma } from 'prisma/generated/client'

export class UpdateAdDto {
  @IsOptional()
  title?: string

  @IsOptional()
  description?: string

  @IsOptional()
  price?: number

  @IsOptional()
  address?: string

  @IsOptional()
  lat?: number

  @IsOptional()
  lng?: number

  @IsOptional()
  features?: Prisma.InputJsonValue

  @IsOptional()
  images?: string[]
}
