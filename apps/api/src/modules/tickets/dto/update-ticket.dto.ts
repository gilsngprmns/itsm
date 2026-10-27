import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator'
import { TICKET_PRIORITIES, TICKET_TYPES } from '../ticket-status'

export class UpdateTicketDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(TICKET_TYPES)
  type?: (typeof TICKET_TYPES)[number]

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject?: string

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  description?: string

  @IsOptional()
  @IsUUID()
  categoryId?: string

  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: (typeof TICKET_PRIORITIES)[number]

  @IsOptional()
  @IsUUID()
  assetId?: string | null

  @IsOptional()
  @IsUUID()
  locationId?: string | null
}
