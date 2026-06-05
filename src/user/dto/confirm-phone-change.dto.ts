import { IsNotEmpty, IsString, Matches } from 'class-validator'

export class ConfirmPhoneChangeDto {
  @IsNotEmpty({ message: 'Код подтверждения обязателен' })
  @IsString({ message: 'Код должен быть строкой' })
  @Matches(/^\d{4}$/, { message: 'Код должен состоять ровно из 4 цифр' })
  code!: string
}
