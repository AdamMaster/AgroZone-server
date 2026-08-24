import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsArray, IsEnum, Matches, Length } from 'class-validator'
import { Transform } from 'class-transformer'
import { PriceUnit, Prisma } from '@/generated/prisma/client'

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

  // Клиент (CreateAdSchema на фронте) всегда шлёт номер уже отформатированным
  // ("+7 (999) 999-99-99") — ровно как и UpdateAdDto ниже по коду. Раньше
  // тут была регулярка на голые цифры (\d{10,15}), которая с таким
  // форматом никогда бы не прошла — просто это не всплывало, потому что
  // buildAdFormData.ts вообще не отправлял phone (см. отдельный фикс там).
  @IsOptional()
  @IsString({ message: 'Номер телефона должен быть строкой.' })
  @Matches(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { message: 'Некорректный формат телефона' })
  phone?: string

  @IsString()
  @IsNotEmpty()
  categoryId!: string

  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  @IsObject()
  @IsOptional()
  features?: Record<string, unknown>
}
