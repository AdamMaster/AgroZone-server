import { IsNotEmpty, IsPhoneNumber, IsString, Matches } from 'class-validator'

export class VerifySmsDto {
  @IsNotEmpty({ message: 'Номер телефона обязателен' })
  @IsPhoneNumber('RU', { message: 'Введите корректный номер телефона' })
  phone!: string

  @IsNotEmpty({ message: 'Код подтверждения обязателен' })
  @IsString({ message: 'Код должен быть строкой' })
  @Matches(/^\d{4}$/, { message: 'Код должен состоять ровно из 4 цифр' })
  code!: string
}
