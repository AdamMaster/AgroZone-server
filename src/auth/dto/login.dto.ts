import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator'

export class LoginDto {
  @IsNotEmpty({ message: 'Поле Email или Телефон обязательно для заполнения.' })
  @IsString({ message: 'Логин должен быть строкой.' })
  login!: string

  @IsString({ message: 'Пароль должен быть строкой.' })
  @IsNotEmpty({ message: 'Пароль не может быть пустым.' })
  @MinLength(6, { message: 'Пароль должен содержать не менее 6 символов.' })
  password!: string

  @IsOptional()
  @IsString()
  code?: string
}
