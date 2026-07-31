import { Transform } from 'class-transformer'
import { IsArray, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Matches } from 'class-validator'
import { Prisma } from 'prisma/generated/client'

export class UpdateAdDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  price?: number

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value
    return value ? [value] : []
  })
  @IsArray()
  @IsString({ each: true })
  existingImages?: string[]

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  address?: string

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  lat?: number

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  lng?: number

  @IsOptional()
  @IsString({ message: 'Номер телефона должен быть строкой.' })
  @Matches(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
    message: 'Некорректный формат телефона'
  })
  phone?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  @IsObject()
  features?: Record<string, unknown>

  @IsOptional()
  @IsString()
  categoryId?: string
}
