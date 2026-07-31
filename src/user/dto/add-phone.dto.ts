import { IsNotEmpty } from 'class-validator'

export class AddPhoneDto {
  @IsNotEmpty({ message: 'Номер телефона обязателен для заполнения' })
  phone!: string
}
