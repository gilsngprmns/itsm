import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

export class AssignTicketDto {
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string
}
