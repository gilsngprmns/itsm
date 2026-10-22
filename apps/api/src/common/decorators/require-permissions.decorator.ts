import { SetMetadata } from '@nestjs/common'

export const REQUIRED_PERMISSIONS = 'required-permissions'
export const ANY_REQUIRED_PERMISSIONS = 'any-required-permissions'

export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions)

export const RequireAnyPermissions = (...permissions: string[]) =>
  SetMetadata(ANY_REQUIRED_PERMISSIONS, permissions)
