import { IsOptional, IsString, MinLength } from 'class-validator'

export class PasswordChangeDto {
  @IsOptional() // Чтобы не ругалось, если поля вообще нет (если это логика позволяет)
  @IsString({ message: 'Пароль должен быть строкой' })
  currentPassword?: string

  @IsString()
  @MinLength(6, { message: 'Пароль минимум 6 символов' })
  newPassword!: string
}
