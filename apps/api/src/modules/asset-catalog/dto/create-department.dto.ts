import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateDepartmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
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
