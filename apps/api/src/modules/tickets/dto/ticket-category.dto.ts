import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

export class CreateTicketCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null
}

export class UpdateTicketCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null
}

export class TicketCategoryStatusDto {
  @IsBoolean()
  isActive!: boolean
}
