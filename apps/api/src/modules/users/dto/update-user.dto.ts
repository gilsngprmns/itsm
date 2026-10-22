import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName?: string

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeCode?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null
}
