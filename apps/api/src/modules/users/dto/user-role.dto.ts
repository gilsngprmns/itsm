import { IsIn } from 'class-validator'

export class UserRoleDto {
  @IsIn(['ADMIN', 'USER', 'AUDIT', 'IT_SUPPORT'])
  roleCode!: 'ADMIN' | 'USER' | 'AUDIT' | 'IT_SUPPORT'
}
