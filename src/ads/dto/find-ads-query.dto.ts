import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { PriceUnit } from 'prisma/generated/client'

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

  // ISO 3166-2:RU код региона (например "RU-KB") — точное совпадение по
  // Ad.regionIsoCode. Не зависит от выбранной категории/уровня каталога,
  // в отличие от features.
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
}
