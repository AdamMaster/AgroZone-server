import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsArray } from 'class-validator'
import { Transform } from 'class-transformer'
import { Prisma } from 'prisma/generated/client'

export class CreateAdDto {
  @IsString()
  @IsNotEmpty()
  title!: string

  @IsString()
  @IsNotEmpty()
  description!: string

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @IsOptional()
  price?: number

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

  @IsString()
  @IsNotEmpty()
  categoryId!: string

  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  @IsObject()
  @IsOptional()
  features?: Record<string, unknown>
}
