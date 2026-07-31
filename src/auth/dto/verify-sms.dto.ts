import { IsNotEmpty, IsPhoneNumber, IsString, Matches } from 'class-validator'

export class VerifySmsDto {
  @IsNotEmpty({ message: 'Номер телефона обязателен' })
  @IsString({ message: 'Номер телефона должен быть строкой' })
  phone!: string

  @IsNotEmpty({ message: 'Код подтверждения обязателен' })
  @IsString({ message: 'Код должен быть строкой' })
  @Matches(/^\d{6}$/, { message: 'Код должен состоять ровно из 6 цифр' })
  code!: string
}
