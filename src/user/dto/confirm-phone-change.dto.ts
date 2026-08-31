import { IsBoolean, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator'

export class ConfirmPhoneChangeDto {
  // См. комментарий в SmsCompleteDto/VerifySmsDto — теперь сюда
  // подставляется call_id от zvonok (подтверждение звонком на
  // проверочный номер), а не введённый пользователем четырёхзначный код.
  @IsNotEmpty({ message: 'Код подтверждения обязателен' })
  @IsString({ message: 'Код должен быть строкой' })
  @Length(1, 32, { message: 'Некорректный код подтверждения' })
  code!: string

  // Актуально только для подтверждения добавления нового (вторичного)
  // номера — если true, номер сразу становится основным. Для подтверждения
  // смены основного номера (confirmPhoneChange) поле не используется:
  // тот номер и так становится основным.
  @IsOptional()
  @IsBoolean({ message: 'makePrimary должно быть булевым значением' })
  makePrimary?: boolean
}
