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

  // Клиент всегда присылает номер в отформатированном виде
  // ("+7 (999) 999-99-99") — как из инпута с маской, так и из выбора
  // существующего номера в модалке. Раньше здесь ожидались "голые" цифры
  // (^\d{10,15}$), что не соответствовало ни формату из формы, ни формату,
  // который принимает UpdateAdDto для того же поля — из-за этого валидный
  // номер отклонялся ещё на уровне ValidationPipe, до вызова сервиса.
  @IsOptional()
  @IsString({ message: 'Номер телефона должен быть строкой.' })
  @Matches(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { message: 'Некорректный формат телефона' })
  phone?: string

  @IsString()
  @IsNotEmpty()
  categoryId!: string

  @Transform(({ value }) => parseJsonField(value))
  @IsObject()
  @IsOptional()
  features?: Record<string, unknown>
}
