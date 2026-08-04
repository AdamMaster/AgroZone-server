import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsArray, IsEnum, Matches, Length } from 'class-validator'
import { Transform } from 'class-transformer'
import { PriceUnit, Prisma } from 'prisma/generated/client'

export class CreateAdDto {
  @IsString()
  @IsNotEmpty()
  title!: string

  @IsString()
  @IsNotEmpty()
  description!: string

  @Transform(({ value }) => (value !== '' && value !== null && value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @IsOptional()
  price?: number

  @IsOptional()
  @IsEnum(PriceUnit)
  unit?: PriceUnit

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[]

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value
    return value ? [value] : []
  })
  @IsArray()
  @IsString({ each: true })
  existingImages?: string[]

  @IsString()
  @IsNotEmpty()
  address!: string

  @Transform(({ value }) => Number(value))
  @IsNumber()
  lat!: number

  @Transform(({ value }) => Number(value))
  @IsNumber()
  lng!: number

  // Регион — приходит из того же DaData-ответа, что и address/lat/lng (см.
  // AddressInput на клиенте). Опционально: не должно ронять создание
  // объявления, если по какой-то причине DaData не смог его определить.
  @IsOptional()
  @IsString()
  region?: string

  @IsOptional()
  @IsString()
  regionIsoCode?: string

  @IsOptional()
  @IsString()
  locality?: string

  @IsOptional()
  @IsString()
  localityFiasId?: string

  @IsOptional()
  @IsString({ message: 'Номер телефона должен быть строкой.' })
  @Matches(/^\d{10,15}$/, { message: 'Некорректный номер телефона.' })
  phone?: string

  @IsString()
  @IsNotEmpty()
  categoryId!: string

  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  @IsObject()
  @IsOptional()
  features?: Record<string, unknown>
}
