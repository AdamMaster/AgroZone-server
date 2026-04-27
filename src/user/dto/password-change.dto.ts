import { IsString, MinLength } from 'class-validator'

export class PasswordChangeDto {
  @IsString()
  oldPassword?: string

  @IsString()
  @MinLength(6, { message: 'Пароль минимум 6 символов' })
  newPassword!: string
}
