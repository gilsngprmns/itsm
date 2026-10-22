import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string

  @IsEmail()
  @MaxLength(254)
  email!: string

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  initialPassword!: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeCode?: string

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string
}
