import { IsNotEmpty, IsPhoneNumber, IsString, Length } from 'class-validator'

export class VerifySmsDto {
  @IsNotEmpty({ message: 'Номер телефона обязателен' })
  @IsString({ message: 'Номер телефона должен быть строкой' })
  phone!: string

  // См. комментарий в SmsCompleteDto — теперь сюда подставляется call_id
  // от zvonok, а не введённый пользователем четырёхзначный код.
  @IsNotEmpty({ message: 'Код подтверждения обязателен' })
  @IsString({ message: 'Код должен быть строкой' })
  @Length(1, 32, { message: 'Некорректный код подтверждения' })
  code!: string
}
