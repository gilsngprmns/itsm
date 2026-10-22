import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

export class AssignAssetDto {
  @IsUUID()
  userId!: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string
}
