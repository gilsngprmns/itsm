import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, buildApiUrl, resolveApiBaseUrl } from './api'

describe('API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('joins the configured base URL and endpoint without duplicate slashes', () => {
    expect(buildApiUrl('/health', 'http://localhost:3000/api/v1/')).toBe(
      'http://localhost:3000/api/v1/health',
    )
  })

  it('adds the API prefix to an origin and avoids duplicate prefixes', () => {
    expect(buildApiUrl('/api/v1/health', 'https://api.example.com/')).toBe(
      'https://api.example.com/api/v1/health',
    )
    expect(
      buildApiUrl(
        '/api/v1/tickets?status=open',
        'https://api.example.com/api/v1',
      ),
    ).toBe('https://api.example.com/api/v1/tickets?status=open')
  })

  it('uses the same-origin API path by default in development', () => {
    expect(buildApiUrl('/health')).toBe('/api/v1/health')
  })

  it('uses a configured tunnel API origin in development and keeps tests isolated', () => {
    const tunnelApi =
      'https://designers-conclusions-isp-proper.trycloudflare.com'
    expect(resolveApiBaseUrl('development', tunnelApi)).toBe(tunnelApi)
    expect(resolveApiBaseUrl('development', '/api/v1')).toBe('/api/v1')
    expect(resolveApiBaseUrl('production', tunnelApi)).toBe(tunnelApi)
    expect(resolveApiBaseUrl('test', tunnelApi)).toBe('/api/v1')
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
