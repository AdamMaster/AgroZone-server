import { IsOptional, IsString } from 'class-validator'

export class DeleteAccountDto {
  // Обязателен только для аккаунтов с паролем (см. UserService.deleteAccount)
  // — у чисто OAuth-пользователей (Google/Yandex) пароля нет, подтверждение
  // паролем для них просто нечем проверять.
  @IsOptional()
  @IsString()
  password?: string
}
