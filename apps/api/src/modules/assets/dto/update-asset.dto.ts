import {
  IsDateString,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'

export class UpdateAssetDto {
  @IsOptional()
  @IsBoolean()
  isShared?: boolean

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  assetTag?: string

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string

  @IsOptional()
  @IsUUID()
  categoryId?: string

  @IsOptional()
  @IsString()
  @MaxLength(150)
  manufacturer?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(150)
  model?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(150)
  serialNumber?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null

  @IsOptional()
  @IsUUID()
  locationId?: string | null

  @IsOptional()
  @IsDateString()
  purchaseDate?: string | null

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999)
  purchaseCost?: number | null

  @IsOptional()
  @IsDateString()
  warrantyStart?: string | null

  @IsOptional()
  @IsDateString()
  warrantyEnd?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null
}
