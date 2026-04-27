import { IsOptional, IsString, MinLength } from 'class-validator'

export class PasswordChangeDto {
  @IsOptional()
  @IsString({ message: 'Пароль должен быть строкой' })
  currentPassword?: string

  @IsString()
  @MinLength(6, { message: 'Пароль минимум 6 символов' })
  newPassword!: string
}
