import { IsString, Matches } from 'class-validator'

export class VerifyBusinessDto {
  // 10 цифр — ИНН юрлица (ООО и т.п.), 12 цифр — ИП или физлицо. Само
  // соответствие ИНН реальной организации/ИП проверяется через DaData в
  // UserService.verifyBusiness — тут только формат.
  @IsString({ message: 'ИНН должен быть строкой.' })
  @Matches(/^(\d{10}|\d{12})$/, { message: 'ИНН должен состоять из 10 или 12 цифр.' })
  inn!: string
}
