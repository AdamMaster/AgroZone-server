import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator'

import { parseBoolean } from '@/libs/common/utils/parse-boolean.util'

export class FindNotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20

  // Позволяет фронту запросить только непрочитанные (вкладка/фильтр в
  // выпадающем списке уведомлений) — без этого параметра отдаём все.
  // Обычный @Type(() => Boolean) тут не подходит: Boolean("false") === true
  // (любая непустая строка truthy), поэтому используем тот же parseBoolean,
  // что и в main.ts для env-переменных.
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? value : parseBoolean(value)))
  @IsBoolean()
  isRead?: boolean
}
