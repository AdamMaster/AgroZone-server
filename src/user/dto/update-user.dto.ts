import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: 'Имя должно быть строкой.' })
  @IsNotEmpty({ message: 'Имя обязательно для заполнения.' })
  name?: string

  @IsOptional()
  @IsString({ message: 'Email должен быть строкой.' })
  @IsEmail({}, { message: 'Некорректный формат email.' })
  @IsNotEmpty({ message: 'Email обязателен для заполнения.' })
  email?: string

  @IsOptional()
  @IsBoolean({ message: 'isTwoFactorEnabled должно быть булевым значением.' })
  isTwoFactorEnabled?: boolean

  @IsOptional()
  @IsString()
  picture?: string
}
