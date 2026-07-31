import { IsNotEmpty } from 'class-validator'

export class SetPrimaryPhoneDto {
  @IsNotEmpty({ message: 'Номер телефона обязателен для заполнения' })
  phone!: string
}
