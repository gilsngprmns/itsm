import { Type } from 'class-transformer'
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { ASSET_STATUSES } from '../asset-status'

export class ListAssetsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string

  @IsOptional()
  @IsIn(ASSET_STATUSES)
  status?: (typeof ASSET_STATUSES)[number]

  @IsOptional()
  @IsUUID()
  categoryId?: string

  @IsOptional()
  @IsUUID()
  locationId?: string

  @IsOptional()
  @IsIn(['assetTag', 'name', 'status', 'createdAt'])
  sort: 'assetTag' | 'name' | 'status' | 'createdAt' = 'createdAt'

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25
}
