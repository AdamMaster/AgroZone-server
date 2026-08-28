import { IsOptional, IsString, MinLength } from 'class-validator'

export class SearchCategoriesDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  q?: string
}
