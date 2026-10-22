import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import { AuthService } from '../../modules/auth/auth.service'
import type { AuthenticatedRequest } from '../decorators/current-user.decorator'

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly cookieName: string

  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    this.cookieName = config.getOrThrow<string>('SESSION_COOKIE_NAME')
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { cookies?: Record<string, unknown> }>()
    const token = request.cookies?.[this.cookieName]

    if (typeof token !== 'string' || token.length > 128) {
      throw new UnauthorizedException('Authentication required')
    }

    const user = await this.auth.getSessionUser(token)
    if (!user) {
      throw new UnauthorizedException('Authentication required')
    }

    ;(request as AuthenticatedRequest).authUser = user
    return true
  }
}
