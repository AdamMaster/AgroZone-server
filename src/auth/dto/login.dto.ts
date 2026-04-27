import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator'

export class LoginDto {
  @IsOptional() // Добавляем телефон как альтернативу
  @IsString({ message: 'Телефон должен быть строкой.' })
  @Matches(/^\d{10,15}$/, { message: 'Номер телефона должен содержать только цифры (10-15 знаков).' })
  phone?: string

  @IsOptional()
  @IsString({ message: 'Email должен быть строкой.' })
  @IsEmail({}, { message: 'Некорректный формат email.' })
  @IsNotEmpty({ message: 'Email обязателен для заполнения.' })
  email!: string

  @IsString({ message: 'Пароль должен быть строкой.' })
  @IsNotEmpty({ message: 'Пароль не может быть пустым.' })
  @MinLength(6, { message: 'Пароль должен содержать не менее 6 символов.' })
  password!: string

  @IsOptional()
  @IsString()
  code?: string
}
