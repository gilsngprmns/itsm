import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null
}
