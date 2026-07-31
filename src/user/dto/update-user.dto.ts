import { IsBoolean, IsEmail, IsOptional, IsString, Matches } from 'class-validator'

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: 'Имя должно быть строкой.' })
  name?: string

  @IsOptional()
  @IsString({ message: 'Email должен быть строкой.' })
  @IsEmail({}, { message: 'Некорректный формат email.' })
  email?: string

  @IsOptional()
  @IsBoolean({ message: 'isTwoFactorEnabled должно быть булевым значением.' })
  isTwoFactorEnabled?: boolean
}
