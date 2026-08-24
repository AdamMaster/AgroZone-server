import { ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsOptional, ValidateIf } from 'class-validator'
import { AdBadge, AdServiceType } from '@/generated/prisma/enums'

export class CreateAdServiceCheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(AdServiceType, { each: true })
  services!: AdServiceType[]

  // Обязателен, только если среди services есть BADGE — проверяется уже в
  // сервисе (см. AdServicesService.createCheckout), тут только формат
  // самого значения, если оно вообще пришло.
  @IsOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(AdBadge)
  badge?: AdBadge
}
