import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateLocationDto {
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
  @MaxLength(100)
  building?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(50)
  floor?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(50)
  room?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null
}
