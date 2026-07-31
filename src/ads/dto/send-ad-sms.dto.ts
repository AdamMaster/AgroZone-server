import { IsNotEmpty, IsString, Matches } from 'class-validator'

export class SendAdSmsDto {
  @IsString({ message: 'Номер телефона должен быть строкой.' })
  @IsNotEmpty({ message: 'Укажите номер телефона.' })
  @Matches(/^\d{10,15}$/, { message: 'Номер телефона должен содержать от 10 до 18 цифр.' })
  phone!: string
}
