import { IsNotEmpty, IsString, IsPhoneNumber } from 'class-validator'

export class VerifySmsDto {
  @IsPhoneNumber()
  @IsNotEmpty()
  phone!: string

  @IsString()
  @IsNotEmpty()
  code!: string
}
