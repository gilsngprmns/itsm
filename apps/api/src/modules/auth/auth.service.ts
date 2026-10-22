import {
  Injectable,
  OnModuleInit,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as argon2 from 'argon2'
import { createHash, randomBytes } from 'node:crypto'
import type { Request } from 'express'
import { DataSource } from 'typeorm'
import { getRequestId } from '../../common/request-id'
import type { AuthenticatedUser, LoginResult } from './auth.types'

const ARGON_OPTIONS: argon2.Options & { type: number } = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
}
const MAX_IP_FAILURES = 10
const MAX_ACCOUNT_FAILURES = 10
const FAILURE_WINDOW_MINUTES = 15
const ACCOUNT_LOCK_MINUTES = 15

interface UserCredentials {
  id: string
  full_name: string
  email: string
  password_hash: string
  is_active: boolean
  failed_login_attempts: number
  locked_until: Date | null
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly sessionTtlMinutes: number
  private dummyHash?: string
  private dummyHashPromise?: Promise<string>

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.sessionTtlMinutes = config.getOrThrow<number>(
      'AUTH_SESSION_TTL_MINUTES',
    )
  }

  async onModuleInit(): Promise<void> {
    await this.getDummyPasswordHash()
  }

  async login(
    emailInput: string,
    password: string,
    request: Request,
  ): Promise<LoginResult> {
    const email = emailInput.trim().toLowerCase()
    const ipAddress = getIpAddress(request)

    if (ipAddress && (await this.isIpRateLimited(ipAddress))) {
      await this.recordAuthEvent('auth.login.rate_limited', null, request)
      throw new HttpException(
        'Too many login attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    const users = (await this.dataSource.query(
      `SELECT id, full_name, email, password_hash, is_active,
              failed_login_attempts, locked_until
       FROM public.users
       WHERE lower(email) = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [email],
    )) as UserCredentials[]
    const user = users[0]
    const passwordMatches = await this.verifyPassword(
      user?.password_hash,
      password,
    )
    const accountLocked =
      user?.locked_until !== null &&
      user?.locked_until !== undefined &&
      new Date(user.locked_until).getTime() > Date.now()

    if (!user || !passwordMatches || !user.is_active || accountLocked) {
      if (user && !accountLocked) {
        await this.dataSource.query(
          `UPDATE public.users
           SET failed_login_attempts = failed_login_attempts + 1,
               locked_until = CASE
                 WHEN failed_login_attempts + 1 >= $2
                   THEN now() + ($3 * interval '1 minute')
                 ELSE locked_until
               END,
               updated_at = now()
           WHERE id = $1`,
          [user.id, MAX_ACCOUNT_FAILURES, ACCOUNT_LOCK_MINUTES],
        )
      }
      await this.recordAuthEvent('auth.login.failed', user?.id ?? null, request)
      throw new UnauthorizedException('Invalid email or password')
    }

    await this.dataSource.query(
      `UPDATE public.users
       SET failed_login_attempts = 0, locked_until = NULL,
           last_login_at = now(), updated_at = now()
       WHERE id = $1`,
      [user.id],
    )

    const token = randomBytes(32).toString('base64url')
    const tokenHash = hashSessionToken(token)
    await this.dataSource.query(
      `INSERT INTO public.refresh_tokens
         (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, now() + ($3 * interval '1 minute'), $4::inet, $5)`,
      [
        user.id,
        tokenHash,
        this.sessionTtlMinutes,
        ipAddress,
        getUserAgent(request),
      ],
    )
    await this.recordAuthEvent('auth.login.succeeded', user.id, request)

    const authenticatedUser = await this.getUserProfile(user.id)
    if (!authenticatedUser) {
      throw new UnauthorizedException('Invalid email or password')
    }

    return { token, user: authenticatedUser }
  }

  async getSessionUser(token: string): Promise<AuthenticatedUser | null> {
    const tokenHash = hashSessionToken(token)
    const rows = (await this.dataSource.query(
      `SELECT u.id, u.full_name, u.email,
              COALESCE(
                array_agg(DISTINCT r.code::text)
                  FILTER (WHERE r.code IS NOT NULL),
                ARRAY[]::text[]
              ) AS roles,
              COALESCE(
                array_agg(DISTINCT p.code::text)
                  FILTER (WHERE p.code IS NOT NULL),
                ARRAY[]::text[]
              ) AS permissions
       FROM public.refresh_tokens s
       JOIN public.users u ON u.id = s.user_id
       LEFT JOIN public.user_roles ur ON ur.user_id = u.id
       LEFT JOIN public.roles r ON r.id = ur.role_id
       LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
       LEFT JOIN public.permissions p ON p.id = rp.permission_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > now()
         AND u.is_active = true
         AND u.deleted_at IS NULL
       GROUP BY u.id, u.full_name, u.email
       LIMIT 1`,
      [tokenHash],
    )) as Array<{
      id: string
      full_name: string
      email: string
      roles: string[]
      permissions: string[]
    }>

    return rows[0] ? toAuthenticatedUser(rows[0]) : null
  }

  async logout(token: string | undefined, request: Request): Promise<void> {
    if (!token || token.length > 128) {
      return
    }

    const tokenHash = hashSessionToken(token)
    const rows = (await this.dataSource.query(
      `UPDATE public.refresh_tokens
       SET revoked_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL
       RETURNING user_id`,
      [tokenHash],
    )) as Array<{ user_id: string }>

    if (rows[0]) {
      await this.recordAuthEvent(
        'auth.logout.succeeded',
        rows[0].user_id,
        request,
      )
    }
  }

  async recordAccessDenied(
    userId: string | undefined,
    request: Request,
  ): Promise<void> {
    await this.recordAuthEvent('auth.access.denied', userId ?? null, request)
  }

  private async getUserProfile(
    userId: string,
  ): Promise<AuthenticatedUser | null> {
    const rows = (await this.dataSource.query(
      `SELECT u.id, u.full_name, u.email,
              COALESCE(
                array_agg(DISTINCT r.code::text)
                  FILTER (WHERE r.code IS NOT NULL),
                ARRAY[]::text[]
              ) AS roles,
              COALESCE(
                array_agg(DISTINCT p.code::text)
                  FILTER (WHERE p.code IS NOT NULL),
                ARRAY[]::text[]
              ) AS permissions
       FROM public.users u
       LEFT JOIN public.user_roles ur ON ur.user_id = u.id
       LEFT JOIN public.roles r ON r.id = ur.role_id
       LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
       LEFT JOIN public.permissions p ON p.id = rp.permission_id
       WHERE u.id = $1 AND u.is_active = true AND u.deleted_at IS NULL
       GROUP BY u.id, u.full_name, u.email`,
      [userId],
    )) as Array<{
      id: string
      full_name: string
      email: string
      roles: string[]
      permissions: string[]
    }>

    return rows[0] ? toAuthenticatedUser(rows[0]) : null
  }

  private async isIpRateLimited(ipAddress: string): Promise<boolean> {
    const rows = (await this.dataSource.query(
      `SELECT count(*)::int AS attempts
       FROM (
         SELECT id
         FROM public.audit_logs
         WHERE action = 'auth.login.failed'
           AND ip_address = $1::inet
           AND created_at >= now() - ($2 * interval '1 minute')
         ORDER BY created_at DESC
         LIMIT $3
       ) recent_attempts`,
      [ipAddress, FAILURE_WINDOW_MINUTES, MAX_IP_FAILURES],
    )) as Array<{ attempts: number }>

    return Number(rows[0]?.attempts ?? 0) >= MAX_IP_FAILURES
  }

  private async recordAuthEvent(
    action: string,
    userId: string | null,
    request: Request,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO public.audit_logs
         (actor_id, action, entity_type, entity_id, request_id, ip_address, user_agent)
       VALUES ($1, $2, 'auth', $1, $3, $4::inet, $5)`,
      [
        userId,
        action,
        getRequestId(request),
        getIpAddress(request),
        getUserAgent(request),
      ],
    )
  }

  private async verifyPassword(
    storedHash: string | undefined,
    password: string,
  ): Promise<boolean> {
    if (!storedHash) {
      await argon2.verify(await this.getDummyPasswordHash(), password)
      return false
    }

    try {
      return await argon2.verify(storedHash, password)
    } catch {
      await argon2.verify(await this.getDummyPasswordHash(), password)
      return false
    }
  }

  private async getDummyPasswordHash(): Promise<string> {
    if (!this.dummyHashPromise) {
      this.dummyHashPromise = argon2
        .hash(randomBytes(32), ARGON_OPTIONS)
        .then((hash) => {
          this.dummyHash = hash
          return hash
        })
    }

    return this.dummyHash ?? this.dummyHashPromise
  }
}

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function toAuthenticatedUser(user: {
  id: string
  full_name: string
  email: string
  roles: string[]
  permissions: string[]
}): AuthenticatedUser {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    roles: user.roles,
    permissions: user.permissions,
  }
}

function getIpAddress(request: Request): string | null {
  return request.ip || null
}

function getUserAgent(request: Request): string | null {
  const userAgent = request.headers['user-agent']
  return typeof userAgent === 'string' ? userAgent.slice(0, 512) : null
}
