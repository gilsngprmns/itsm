import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, buildApiUrl } from './api'

describe('API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('joins the configured base URL and endpoint without duplicate slashes', () => {
    expect(buildApiUrl('/health', 'http://localhost:3000/api/v1/')).toBe(
      'http://localhost:3000/api/v1/health',
    )
  })

  it('reports failed HTTP responses without exposing response bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: vi.fn().mockResolvedValue({
          message: 'database credentials must not be exposed',
        }),
      }),
    )

    await expect(apiRequest('health')).rejects.toThrow(
      'API request failed with status 503',
    )
  })

  it('includes cookies and notifies the auth provider when a session expires', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'private response data' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetch)
    const eventTarget = new EventTarget()
    vi.stubGlobal('window', eventTarget)
    const unauthorized = vi.fn()
    eventTarget.addEventListener('api:unauthorized', unauthorized)

    await expect(apiRequest('auth/me')).rejects.toThrow(
      'API request failed with status 401',
    )
    expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'include' })
    expect(unauthorized).toHaveBeenCalledOnce()
  })

  it('returns undefined for the bodyless logout response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 204,
        }),
      ),
    )

    await expect(apiRequest<void>('auth/logout')).resolves.toBeUndefined()
  })
})
