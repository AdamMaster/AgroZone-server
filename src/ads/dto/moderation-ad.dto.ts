import { IsOptional, IsString, MaxLength } from 'class-validator'

export class ModerateAdDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string
}
