import { ApiRequestError } from '../lib/api'

export function loginFailureMessage(cause: unknown): string {
  if (cause instanceof ApiRequestError && cause.status === 401) {
    return 'Email or password is incorrect.'
  }
  if (cause instanceof ApiRequestError && cause.status === 429) {
    return 'Too many login attempts. Try again later.'
  }
  return 'Unable to sign in. Check your connection and try again.'
}

export function postLoginPath(locationState: unknown): string {
  const from = (locationState as { from?: unknown } | null)?.from
  return typeof from === 'string' &&
    from.startsWith('/') &&
    !from.startsWith('//')
    ? from
    : '/dashboard'
}
