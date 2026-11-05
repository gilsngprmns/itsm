import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'
import { TICKET_STATUSES } from '../ticket-status'

export class TicketStatusDto {
  @IsIn(TICKET_STATUSES)
  status!: (typeof TICKET_STATUSES)[number]

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  resolutionSummary?: string
}
