import { Type } from 'class-transformer'
import { IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator'

// Пагинация "вверх по истории" курсором, а не страницами (page/limit) — в
// чате новые сообщения появляются постоянно, и сдвиг на "страницу 2" при
// постраничной пагинации то и дело показывал бы задвоение/пропуск
// сообщений. cursor — createdAt самого старого уже полученного сообщения,
// сервис отдаёт всё, что старше него.
export class FindMessagesQueryDto {
  @IsOptional()
  @IsISO8601()
  cursor?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30
}
