const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export function buildApiUrl(
  path: string,
  baseUrl: string = configuredApiBaseUrl,
): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
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
