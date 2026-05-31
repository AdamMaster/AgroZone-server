import { IsNotEmpty, IsString, Length, MinLength, Validate } from 'class-validator'
import { SmsRegisterDto } from './sms-register.dto'
import { IsPasswordsMatchingConstraint } from 'src/libs/common/decorators/is-passwords-matching-constraint.decorator'

export class SmsCompleteDto extends SmsRegisterDto {
  @IsString({ message: 'Код должен быть строкой.' })
  @IsNotEmpty({ message: 'Код обязателен.' })
  @Length(4, 4, { message: 'Код должен состоять из 4 цифр.' })
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
}
