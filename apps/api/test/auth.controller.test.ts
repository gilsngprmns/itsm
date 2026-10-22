import { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { AuthController } from '../src/modules/auth/auth.controller'
import { AuthService } from '../src/modules/auth/auth.service'
import type { AuthenticatedUser } from '../src/modules/auth/auth.types'

const user: AuthenticatedUser = {
  id: 'user-1',
  fullName: 'Test User',
  email: 'user@example.test',
  roles: ['ADMIN'],
  permissions: ['users.read'],
}

function createController(nodeEnv = 'development') {
  const auth = {
    login: vi.fn().mockResolvedValue({ token: 'opaque-token', user }),
    logout: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthService
  const config = new ConfigService({
    SESSION_COOKIE_NAME: 'itsm_session',
    NODE_ENV: nodeEnv,
    AUTH_SESSION_TTL_MINUTES: 60,
  })
  return { auth, controller: new AuthController(auth, config) }
}

describe('AuthController', () => {
  it('sets a strict HttpOnly cookie without exposing the token in its response', async () => {
    const { auth, controller } = createController()
    const cookie = vi.fn()
    const clearCookie = vi.fn()
    const response = { cookie, clearCookie } as unknown as Response
    const request = {
      ip: '127.0.0.1',
      headers: {},
    } as Request

    const result = await controller.login(
      { email: user.email, password: 'private-password' },
      request,
      response,
    )

    expect(auth.login).toHaveBeenCalledWith(
      user.email,
      'private-password',
      request,
    )
    expect(cookie).toHaveBeenCalledWith(
      'itsm_session',
      'opaque-token',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        path: '/api/v1',
        maxAge: 60 * 60 * 1000,
      }),
    )
    expect(clearCookie).toHaveBeenCalledWith(
      'itsm_session',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/api/v1/auth',
      }),
    )
    expect(result).toEqual({ user })
    expect(JSON.stringify(result)).not.toContain('opaque-token')
  })

  it('marks session cookies Secure in production', async () => {
    const { controller } = createController('production')
    const cookie = vi.fn()
    const clearCookie = vi.fn()

    await controller.login(
      { email: user.email, password: 'private-password' },
      { ip: '127.0.0.1', headers: {} } as Request,
      { cookie, clearCookie } as unknown as Response,
    )

    expect(cookie.mock.calls[0][2]).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api/v1',
    })
  })

  it('revokes the presented cookie and clears it with matching path options', async () => {
    const { auth, controller } = createController()
    const clearCookie = vi.fn()

    await controller.logout(
      {
        cookies: { itsm_session: 'opaque-token' },
        ip: '127.0.0.1',
        headers: {},
      } as unknown as Request & { cookies: Record<string, unknown> },
      { clearCookie } as unknown as Response,
    )

    expect(auth.logout).toHaveBeenCalledWith(
      'opaque-token',
      expect.objectContaining({ ip: '127.0.0.1' }),
    )
    expect(clearCookie).toHaveBeenCalledWith(
      'itsm_session',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/api/v1',
      }),
    )
    expect(clearCookie).toHaveBeenCalledWith(
      'itsm_session',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/api/v1/auth',
      }),
    )
  })
})
