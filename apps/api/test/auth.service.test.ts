import { HttpStatus, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as argon2 from 'argon2'
import { createHash } from 'node:crypto'
import type { Request } from 'express'
import { DataSource } from 'typeorm'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { AuthService } from '../src/modules/auth/auth.service'

const account = {
  id: 'user-1',
  full_name: 'Test User',
  email: 'user@example.test',
  is_active: true,
  failed_login_attempts: 0,
  locked_until: null,
}

let passwordHash: string

beforeAll(async () => {
  passwordHash = await argon2.hash('correct-horse-battery-staple', {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  })
})

function createService() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: 'postgres://localhost/it_db',
  })
  const query = vi.spyOn(dataSource, 'query')
  const config = new ConfigService({ AUTH_SESSION_TTL_MINUTES: 60 })
  return { service: new AuthService(dataSource, config), query }
}

function createRequest(): Request {
  return {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'auth-service-test' },
  } as Request
}

describe('AuthService login', () => {
  it('uses the same credential error for an unknown email', async () => {
    const { service, query } = createService()
    query
      .mockResolvedValueOnce([{ attempts: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await expect(
      service.login(
        'missing@example.test',
        'a-valid-password',
        createRequest(),
      ),
    ).rejects.toMatchObject({
      status: 401,
      response: {
        message: 'Invalid email or password',
      },
    })
    expect(query).toHaveBeenCalledTimes(3)
    expect(query.mock.calls[2][1]).toContain(null)
    expect(query.mock.calls[2][1]).toContain('auth.login.failed')
  }, 15_000)

  it('rejects a disabled account and records no sensitive credentials', async () => {
    const { service, query } = createService()
    query
      .mockResolvedValueOnce([{ attempts: 0 }])
      .mockResolvedValueOnce([
        { ...account, password_hash: passwordHash, is_active: false },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await expect(
      service.login(
        'USER@example.test',
        'correct-horse-battery-staple',
        createRequest(),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException)
    expect(query.mock.calls[2][0]).toContain('failed_login_attempts')
    expect(query.mock.calls[3][1]).not.toContain('correct-horse-battery-staple')
  })

  it('locks an active account after ten failed login attempts', async () => {
    const { service, query } = createService()
    query
      .mockResolvedValueOnce([{ attempts: 0 }])
      .mockResolvedValueOnce([{ ...account, password_hash: passwordHash }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await expect(
      service.login(account.email, 'incorrect-password', createRequest()),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    expect(query.mock.calls[2][1]).toEqual([account.id, 10, 15])
  })

  it('creates an opaque hashed session and returns server-side permissions', async () => {
    const { service, query } = createService()
    query
      .mockResolvedValueOnce([{ attempts: 0 }])
      .mockResolvedValueOnce([{ ...account, password_hash: passwordHash }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: account.id,
          full_name: account.full_name,
          email: account.email,
          roles: ['ADMIN'],
          permissions: ['users.read'],
        },
      ])

    const result = await service.login(
      account.email,
      'correct-horse-battery-staple',
      createRequest(),
    )

    expect(result.user).toEqual({
      id: account.id,
      fullName: account.full_name,
      email: account.email,
      roles: ['ADMIN'],
      permissions: ['users.read'],
    })
    expect(result.token).toMatch(/^[\w-]{43}$/)
    const insertedTokenHash = query.mock.calls[3][1]?.[1]
    expect(insertedTokenHash).toBe(
      createHash('sha256').update(result.token).digest('hex'),
    )
    expect(JSON.stringify(result)).not.toContain(insertedTokenHash)
    expect(query.mock.calls[2][0]).toContain('last_login_at')
  })

  it('denies IPs over the failure limit before checking credentials', async () => {
    const { service, query } = createService()
    query.mockResolvedValueOnce([{ attempts: 10 }]).mockResolvedValueOnce([])

    await expect(
      service.login('user@example.test', 'password', createRequest()),
    ).rejects.toHaveProperty('status', HttpStatus.TOO_MANY_REQUESTS)
    expect(query).toHaveBeenCalledTimes(2)
    expect(query.mock.calls[1][1]).toContain('auth.login.rate_limited')
    expect(query.mock.calls[0][0]).toContain("action = 'auth.login.failed'")
    expect(query.mock.calls[0][0]).not.toContain("'auth.login.rate_limited'")
  })
})

describe('AuthService session lifecycle', () => {
  it('only resolves active, unexpired, non-revoked sessions', async () => {
    const { service, query } = createService()
    query.mockResolvedValueOnce([])

    await expect(service.getSessionUser('opaque-token')).resolves.toBeNull()
    expect(query.mock.calls[0][0]).toContain('s.revoked_at IS NULL')
    expect(query.mock.calls[0][0]).toContain('s.expires_at > now()')
    expect(query.mock.calls[0][1]).toEqual([
      createHash('sha256').update('opaque-token').digest('hex'),
    ])
  })

  it('revokes the hashed token and never stores the raw session token in audit', async () => {
    const { service, query } = createService()
    query
      .mockResolvedValueOnce([{ user_id: account.id }])
      .mockResolvedValueOnce([])
    const rawToken = 'opaque-session-token'

    await service.logout(rawToken, createRequest())

    expect(query.mock.calls[0][1]).toEqual([
      createHash('sha256').update(rawToken).digest('hex'),
    ])
    expect(query.mock.calls[1][1]).not.toContain(rawToken)
  })
})
