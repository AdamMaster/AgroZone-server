import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator'

export class ConfirmPhoneChangeDto {
  // generateSmsCode() генерирует 6-значный код (раньше было 4 — усилили
  // защиту от перебора кода подтверждения). Регулярка тут должна совпадать
  // с реальной длиной кода, иначе валидный код будет отклонён ещё на
  // уровне ValidationPipe.
  @IsNotEmpty({ message: 'Код подтверждения обязателен' })
  @IsString({ message: 'Код должен быть строкой' })
  @Matches(/^\d{6}$/, { message: 'Код должен состоять ровно из 6 цифр' })
  code!: string

  // true — когда номер подтверждают со страницы профиля (это и есть смена
  // основного номера аккаунта). Не передаётся из формы объявления — там
  // добавленный номер остаётся дополнительным контактным, не основным.
  @IsOptional()
  @IsBoolean({ message: 'makePrimary должен быть булевым значением' })
  makePrimary?: boolean
}
