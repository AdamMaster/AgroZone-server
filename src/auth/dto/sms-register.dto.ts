import { IsNotEmpty, IsString, Matches } from 'class-validator'

export class SmsRegisterDto {
  @IsString({ message: 'Телефон должен быть строкой.' })
  @IsNotEmpty({ message: 'Номер телефона обязателен.' })
  @Matches(/^\d{10,15}$/, { message: 'Номер телефона должен содержать от 10 до 15 цифр.' })
  phone!: string
}
