import { IsNotEmpty } from 'class-validator'

export class SearchSuggestionDto {
  @IsNotEmpty()
  id!: string

  @IsNotEmpty()
  type!: 'category' | 'ad'

  @IsNotEmpty()
  rawName!: string

  @IsNotEmpty()
  name!: string
}
