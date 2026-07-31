import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsArray, IsEnum, Matches, Length } from 'class-validator'
import { Transform } from 'class-transformer'
import { PriceUnit, Prisma } from 'prisma/generated/client'
import { parseJsonField } from '@/libs/common/utils/parse-json-field.util'

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

  @IsOptional()
  @IsString({ message: 'Номер телефона должен быть строкой.' })
  @Matches(/^\d{10,15}$/, { message: 'Некорректный номер телефона.' })
  phone?: string

  @IsString()
  @IsNotEmpty()
  categoryId!: string

  @Transform(({ value }) => parseJsonField(value))
  @IsObject()
  @IsOptional()
  features?: Record<string, unknown>
}
