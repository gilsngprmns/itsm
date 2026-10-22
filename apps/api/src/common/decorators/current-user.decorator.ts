import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import type { AuthenticatedUser } from '../../modules/auth/auth.types'

export interface AuthenticatedRequest extends Request {
  authUser: AuthenticatedUser
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().authUser,
)
