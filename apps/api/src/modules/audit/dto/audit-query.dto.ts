import { Type } from 'class-transformer'
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class AuditQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string

  @IsOptional()
  @IsUUID()
  entityId?: string

  @IsOptional()
  @IsUUID()
  actorUserId?: string

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc'

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
