import { IsNotEmpty, IsString } from 'class-validator'

export class CheckUserDto {
  @IsNotEmpty({ message: 'Введите Email или номер телефона' })
  @IsString({ message: 'Идентификатор должен быть строкой' })
  identifier!: string
}
