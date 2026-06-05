import { IsNotEmpty, Matches } from 'class-validator'

export class PhoneChangeDto {
  @IsNotEmpty({ message: 'Номер телефона обязателен для заполнения' })
  @Matches(/^(\+)?\d{10,15}$/, { message: 'Введите корректный номер телефона' })
  newPhone!: string
}
