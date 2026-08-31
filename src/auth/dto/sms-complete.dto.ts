import { Equals, IsBoolean, IsNotEmpty, IsString, Length, MinLength, Validate } from 'class-validator'
import { SmsRegisterDto } from './sms-register.dto'
import { IsPasswordsMatchingConstraint } from 'src/libs/common/decorators/is-passwords-matching-constraint.decorator'

export class SmsCompleteDto extends SmsRegisterDto {
  // Раньше тут был четырёхзначный код, который пользователь вводил сам
  // (flashcall/tellcode). Теперь подтверждение по факту звонка на
  // проверочный номер, а сюда фронт подставляет call_id от zvonok
  // (см. AuthService.checkSmsCallbackStatus) — это куда более длинное
  // число, поэтому длину больше не ограничиваем четырьмя цифрами.
  @IsString({ message: 'Код должен быть строкой.' })
  @IsNotEmpty({ message: 'Код обязателен.' })
  @Length(1, 32, { message: 'Некорректный код подтверждения.' })
  code!: string

  @IsString({ message: 'Имя должно быть строкой.' })
  @IsNotEmpty({ message: 'Имя обязательно.' })
  name!: string

  @IsString({ message: 'Пароль должен быть строкой.' })
  @MinLength(6, { message: 'Пароль должен содержать минимум 6 символов.' })
  password!: string

  @IsString({ message: 'Пароль подтверждения должен быть строкой.' })
  @Validate(IsPasswordsMatchingConstraint, { message: 'Пароли не совпадают.' })
  passwordRepeat!: string

  @IsBoolean({ message: 'Согласие на обработку персональных данных указано некорректно.' })
  @Equals(true, { message: 'Необходимо дать согласие на обработку персональных данных.' })
  personalDataConsent!: boolean
}
