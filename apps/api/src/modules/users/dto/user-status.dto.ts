import { IsBoolean } from 'class-validator'

export class UserStatusDto {
  @IsBoolean()
  isActive!: boolean
}
