import { IsIn } from 'class-validator'

export class UserRoleDto {
  @IsIn(['ADMIN', 'USER', 'AUDIT'])
  roleCode!: 'ADMIN' | 'USER' | 'AUDIT'
}
