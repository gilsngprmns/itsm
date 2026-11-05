export function resolveApiBaseUrl(
  mode: string,
  configuredUrl?: string,
): string {
  if (mode === 'test') return '/api/v1'
  return configuredUrl?.trim() || '/api/v1'
}

const configuredApiBaseUrl = resolveApiBaseUrl(
  import.meta.env.MODE,
  import.meta.env.VITE_API_BASE_URL,
)

export function buildApiUrl(
  path: string,
  baseUrl: string = configuredApiBaseUrl,
): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  const apiBaseUrl = normalizedBaseUrl.endsWith('/api/v1')
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/api/v1`
  const normalizedPath = path
    .replace(/^\/+/, '')
    .replace(/^api\/v1(?:\/|(?=\?|$))/, '')
  return `${apiBaseUrl}/${normalizedPath}`
}

export class ApiRequestError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers,
  })
  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event('api:unauthorized'))
    }
    throw new ApiRequestError(
      response.status,
      `API request failed with status ${response.status}`,
    )
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
