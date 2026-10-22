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
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../ticket-status'

export class ListTicketsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string

  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: (typeof TICKET_STATUSES)[number]

  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: (typeof TICKET_PRIORITIES)[number]

  @IsOptional()
  @IsUUID()
  categoryId?: string

  @IsOptional()
  @IsUUID()
  assigneeId?: string

  @IsOptional()
  @IsUUID()
  requesterId?: string

  @IsOptional()
  @IsUUID()
  assetId?: string

  @IsOptional()
  @IsIn(['ticketNumber', 'subject', 'status', 'priority', 'createdAt'])
  sortBy: 'ticketNumber' | 'subject' | 'status' | 'priority' | 'createdAt' =
    'createdAt'

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
