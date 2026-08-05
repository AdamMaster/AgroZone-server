import { IsArray, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator'

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string

  // Ссылки на уже загруженные файлы (тот же аплоад-пайплайн, что и у фото
  // объявлений) — сам загрузчик вложений для чата будет отдельным шагом,
  // поле уже закладываем, чтобы потом не трогать схему/DTO ещё раз.
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  attachments?: string[]
}
