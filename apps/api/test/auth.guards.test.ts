import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedUser } from '../src/modules/auth/auth.types'
import { AuthService } from '../src/modules/auth/auth.service'
import {
  ANY_REQUIRED_PERMISSIONS,
  REQUIRED_PERMISSIONS,
} from '../src/common/decorators/require-permissions.decorator'
import type { AuthenticatedRequest } from '../src/common/decorators/current-user.decorator'
import { OriginGuard } from '../src/common/guards/origin.guard'
import { PermissionsGuard } from '../src/common/guards/permissions.guard'
import { SessionGuard } from '../src/common/guards/session.guard'

afterEach(() => vi.restoreAllMocks())

function createContext(request: object): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}

describe('OriginGuard', () => {
  it('requires an exact configured origin for state-changing requests', () => {
    const guard = new OriginGuard(
      new ConfigService({ CORS_ORIGINS: 'http://localhost:5173' }),
    )

    expect(() =>
      guard.canActivate(
        createContext({
          headers: {
            origin: 'http://localhost:5173.evil.test',
          },
        }),
      ),
    ).toThrow(ForbiddenException)
  })

  it('rejects cross-site fetches even when they include the allowed origin', () => {
    const guard = new OriginGuard(
      new ConfigService({ CORS_ORIGINS: 'http://localhost:5173' }),
    )

    expect(() =>
      guard.canActivate(
        createContext({
          headers: {
            origin: 'http://localhost:5173',
            'sec-fetch-site': 'cross-site',
          },
        }),
      ),
    ).toThrow(ForbiddenException)
  })
})

describe('SessionGuard', () => {
  it('rejects expired or revoked sessions returned as absent by the database', async () => {
    const auth = {
      getSessionUser: vi.fn().mockResolvedValue(null),
    } as unknown as AuthService
    const guard = new SessionGuard(
      new ConfigService({ SESSION_COOKIE_NAME: 'itsm_session' }),
      auth,
    )

    await expect(
      guard.canActivate(
        createContext({
          cookies: { itsm_session: 'opaque-session' },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })
})

describe('PermissionsGuard', () => {
  it('denies a user missing the required database permission and audits it', async () => {
    const user: AuthenticatedUser = {
      id: 'user-1',
      fullName: 'User',
      email: 'user@example.test',
      roles: ['USER'],
      permissions: [],
    }
    const request = { authUser: user } as AuthenticatedRequest
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['users.read']),
    } as unknown as Reflector
    const auth = {
      recordAccessDenied: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthService
    const guard = new PermissionsGuard(reflector, auth)

    await expect(
      guard.canActivate(createContext(request)),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(reflector.getAllAndOverride).toHaveBeenNthCalledWith(
      1,
      REQUIRED_PERMISSIONS,
      expect.any(Array),
    )
    expect(reflector.getAllAndOverride).toHaveBeenNthCalledWith(
      2,
      ANY_REQUIRED_PERMISSIONS,
      expect.any(Array),
    )
    expect(auth.recordAccessDenied).toHaveBeenCalledWith(user.id, request)
  })

  it.each([
    {
      role: 'ADMIN',
      permissions: ['users.read', 'users.update', 'tickets.update'],
      allowed: 'users.update',
      denied: 'settings.root',
    },
    {
      role: 'USER',
      permissions: ['tickets.create', 'tickets.read.own'],
      allowed: 'tickets.create',
      denied: 'users.read',
    },
    {
      role: 'AUDIT',
      permissions: ['audit.read', 'reports.read', 'tickets.read.all'],
      allowed: 'audit.read',
      denied: 'tickets.update',
    },
  ])(
    'enforces the database-derived $role permission set',
    async ({ role, permissions, allowed, denied }) => {
      const user: AuthenticatedUser = {
        id: `${role.toLowerCase()}-id`,
        fullName: role,
        email: `${role.toLowerCase()}@example.test`,
        roles: [role],
        permissions,
      }
      const request = { authUser: user } as AuthenticatedRequest
      const reflector = {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRED_PERMISSIONS ? [allowed] : undefined,
        ),
      } as unknown as Reflector
      const auth = {
        recordAccessDenied: vi.fn().mockResolvedValue(undefined),
      } as unknown as AuthService
      const guard = new PermissionsGuard(reflector, auth)

      await expect(guard.canActivate(createContext(request))).resolves.toBe(
        true,
      )

      const deniedGuard = new PermissionsGuard(reflector, auth)
      const deniedContext = createContext(request)
      vi.mocked(reflector.getAllAndOverride).mockImplementation((key) =>
        key === REQUIRED_PERMISSIONS ? [denied] : undefined,
      )
      await expect(
        deniedGuard.canActivate(deniedContext),
      ).rejects.toBeInstanceOf(ForbiddenException)
    },
  )

  it('allows a user with one of the explicitly required permissions', async () => {
    const user: AuthenticatedUser = {
      id: 'user-id',
      fullName: 'User',
      email: 'user@example.test',
      roles: ['USER'],
      permissions: ['tickets.read.own'],
    }
    const reflector = {
      getAllAndOverride: vi.fn((key: string) =>
        key === ANY_REQUIRED_PERMISSIONS
          ? ['tickets.read.all', 'tickets.read.own']
          : undefined,
      ),
    } as unknown as Reflector
    const auth = {
      recordAccessDenied: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthService
    const guard = new PermissionsGuard(reflector, auth)

    await expect(
      guard.canActivate(createContext({ authUser: user })),
    ).resolves.toBe(true)
  })
})
