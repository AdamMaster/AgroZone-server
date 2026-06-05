import { IsNotEmpty, IsNumber, IsString } from 'class-validator'

export class CreateAdDto {
  @IsString()
  @IsNotEmpty()
  title!: string

  @IsString()
  @IsNotEmpty()
  description!: string

  @IsNumber()
  price!: number

  @IsString()
  @IsNotEmpty()
  categoryId!: string
}
