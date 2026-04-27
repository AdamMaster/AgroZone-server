import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator'

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: 'Имя должно быть строкой.' })
  name?: string

  @IsOptional()
  @IsString({ message: 'Телефон должен быть строкой.' })
  @Matches(/^\d{10,15}$/, { message: 'Номер телефона должен содержать только цифры (10-15 знаков).' })
  phone?: string

  @IsOptional()
  @IsString({ message: 'Email должен быть строкой.' })
  @IsEmail({}, { message: 'Некорректный формат email.' })
  email?: string

  @IsOptional()
  @IsBoolean({ message: 'isTwoFactorEnabled должно быть булевым значением.' })
  isTwoFactorEnabled?: boolean

  @IsOptional()
  @IsString()
  picture?: string
}
