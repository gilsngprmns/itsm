import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator'

export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(150)
  contactPerson?: string | null

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  address?: string | null

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  website?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null
}
