import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator'

export class ConfirmPhoneChangeDto {
  @IsNotEmpty({ message: 'Код подтверждения обязателен' })
  @IsString({ message: 'Код должен быть строкой' })
  @Matches(/^\d{4}$/, { message: 'Код должен состоять ровно из 4 цифр' })
  code!: string

  // Актуально только для подтверждения добавления нового (вторичного)
  // номера — если true, номер сразу становится основным. Для подтверждения
  // смены основного номера (confirmPhoneChange) поле не используется:
  // тот номер и так становится основным.
  @IsOptional()
  @IsBoolean({ message: 'makePrimary должно быть булевым значением' })
  makePrimary?: boolean
}
