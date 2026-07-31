import { IsNotEmpty, IsString, Matches } from 'class-validator'

export class ConfirmPhoneChangeDto {
  @IsNotEmpty({ message: 'Код подтверждения обязателен' })
  @IsString({ message: 'Код должен быть строкой' })
  @Matches(/^\d{6}$/, { message: 'Код должен состоять ровно из 6 цифр' })
  code!: string
}
