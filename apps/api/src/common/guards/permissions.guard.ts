import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AuthenticatedRequest } from '../decorators/current-user.decorator'
import {
  ANY_REQUIRED_PERMISSIONS,
  REQUIRED_PERMISSIONS,
} from '../decorators/require-permissions.decorator'
import { AuthService } from '../../modules/auth/auth.service'

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    )
    const requiredAny = this.reflector.getAllAndOverride<string[]>(
      ANY_REQUIRED_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    )
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const user = request.authUser

    if (
      !user ||
      ((!required?.length ||
        !required.every((permission) =>
          user.permissions.includes(permission),
        )) &&
        (!requiredAny?.length ||
          !requiredAny.some((permission) =>
            user.permissions.includes(permission),
          )))
    ) {
      await this.auth.recordAccessDenied(user?.id, request)
      throw new ForbiddenException('Insufficient permissions')
    }

    return true
  }
}
