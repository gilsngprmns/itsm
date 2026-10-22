import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'
import { OriginGuard } from '../../common/guards/origin.guard'
import { SessionGuard } from '../../common/guards/session.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { LoginDto } from './dto/login.dto'
import { AuthService } from './auth.service'
import type { AuthenticatedUser } from './auth.types'

const API_COOKIE_PATH = '/api/v1'
const LEGACY_AUTH_COOKIE_PATH = '/api/v1/auth'

@Controller('auth')
export class AuthController {
  private readonly cookieName: string
  private readonly cookieSecure: boolean
  private readonly sessionTtlMinutes: number

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.cookieName = config.getOrThrow<string>('SESSION_COOKIE_NAME')
    this.cookieSecure = config.getOrThrow<string>('NODE_ENV') === 'production'
    this.sessionTtlMinutes = config.getOrThrow<number>(
      'AUTH_SESSION_TTL_MINUTES',
    )
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginGuard)
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: AuthenticatedUser }> {
    const result = await this.auth.login(body.email, body.password, request)
    response.clearCookie(this.cookieName, {
      ...this.getCookieOptions(),
      path: LEGACY_AUTH_COOKIE_PATH,
    })
    response.cookie(this.cookieName, result.token, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'strict',
      path: API_COOKIE_PATH,
      maxAge: this.sessionTtlMinutes * 60 * 1000,
    })
    return { user: result.user }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginGuard)
  async logout(
    @Req() request: Request & { cookies?: Record<string, unknown> },
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = request.cookies?.[this.cookieName]
    await this.auth.logout(
      typeof token === 'string' ? token : undefined,
      request,
    )
    response.clearCookie(this.cookieName, this.getCookieOptions())
    response.clearCookie(this.cookieName, {
      ...this.getCookieOptions(),
      path: LEGACY_AUTH_COOKIE_PATH,
    })
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: AuthenticatedUser): { user: AuthenticatedUser } {
    return { user }
  }

  private getCookieOptions(): {
    httpOnly: true
    secure: boolean
    sameSite: 'strict'
    path: string
  } {
    return {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'strict',
      path: API_COOKIE_PATH,
    }
  }
}
