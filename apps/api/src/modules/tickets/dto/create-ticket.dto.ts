import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator'
import { TICKET_PRIORITIES } from '../ticket-status'

export class CreateTicketDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string

  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  description!: string

  @IsUUID()
  categoryId!: string

  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: (typeof TICKET_PRIORITIES)[number]

  @IsOptional()
  @IsUUID()
  assetId?: string

  @IsOptional()
  @IsUUID()
  locationId?: string
}
