import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { PriceUnit } from '@/generated/prisma/client'
import { UserType } from '@/generated/prisma/enums'

// Сортировка списка объявлений. По умолчанию (если sortBy не передан) —
// DATE_DESC, см. AdsService.findAll.
export enum AdsSortBy {
  DATE_DESC = 'date_desc',
  DATE_ASC = 'date_asc',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc'
}

export class FindAdsQueryDto {
  @IsOptional()
  @IsString()
  categoryId?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number

  @IsOptional()
  @IsString()
  search?: string

  // Единица цены, в рамках которой действует диапазон minPrice/maxPrice.
  // Обязательна, если задан хотя бы один из них — сравнивать цену "за кг" и
  // "за тонну" в одном диапазоне некорректно (см. AdsService.findAll).
  @IsOptional()
  @IsEnum(PriceUnit)
  unit?: PriceUnit

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number

  @IsOptional()
  @IsEnum(AdsSortBy)
  sortBy?: AdsSortBy

  // Несмотря на название (оставили для совместимости с фронтом/URL) — это
  // НЕ настоящий ISO 3166-2:RU код, а базовое название региона из
  // справочника RuCity (например "Алтай", "Краснодарский" — см.
  // AdsService.getAvailableLocations/buildRegionMatchPattern). Настоящие
  // ISO-коды регионов мы намеренно не храним и не сравниваем — не удалось
  // надёжно подтвердить точный формат (см. обсуждение). Не зависит от
  // выбранной категории/уровня каталога, в отличие от features.
  @IsOptional()
  @IsString()
  regionIsoCode?: string

  // Более узкий уровень, чем regionIsoCode — точечный фильтр по
  // конкретному городу/селу (Ad.localityFiasId). Взаимоисключим с
  // regionIsoCode на фронте (см. LocationFilter), но бэкенд не завязан на
  // это и просто ANDит оба условия, если вдруг придут одновременно.
  @IsOptional()
  @IsString()
  localityFiasId?: string

  // JSON-строка вида:
  //   {"soil_type":["Чернозём"],"humidity":{"min":10,"max":80},"is_organic":true}
  // Ключи должны совпадать с CategoryFeature.name выбранной категории;
  // если задан features — categoryId обязателен. Разбирается и
  // валидируется в AdsService.resolveFeatureFilters (там же тихо
  // игнорируются неизвестные/нефильтруемые/устаревшие ключи).
  @IsOptional()
  @IsString()
  features?: string

  // Фильтр по самозаявленному типу продавца (частное лицо / ИП / компания)
  // — сравнивается с users.type (см. AdsService.findAll). Не зависит от
  // выбранной категории, как и regionIsoCode/localityFiasId.
  @IsOptional()
  @IsEnum(UserType)
  sellerType?: UserType
}
