import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'
import { ASSET_STATUSES } from '../asset-status'

export class AssetStatusDto {
  @IsIn(ASSET_STATUSES)
  status!: (typeof ASSET_STATUSES)[number]

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string
}
