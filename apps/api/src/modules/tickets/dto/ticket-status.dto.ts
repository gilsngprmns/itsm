import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'
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
  @MaxLength(4000)
  resolutionSummary?: string
}
