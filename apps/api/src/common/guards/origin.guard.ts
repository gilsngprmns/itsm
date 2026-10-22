import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>

  constructor(config: ConfigService) {
    this.allowedOrigins = new Set(
      config.getOrThrow<string>('CORS_ORIGINS').split(','),
    )
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const origin = request.headers.origin
    const fetchSite = request.headers['sec-fetch-site']

    if (
      typeof origin !== 'string' ||
      !this.allowedOrigins.has(origin) ||
      fetchSite === 'cross-site'
    ) {
      throw new ForbiddenException('Request origin is not allowed')
    }

    return true
  }
}
