import { IsDateString, IsOptional } from 'class-validator'

export class ReportsQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string
}
