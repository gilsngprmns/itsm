import { ApiRequestError } from '../lib/api'

export function ticketErrorMessage(
  error: unknown,
  action = 'complete the request',
): string {
  if (!(error instanceof ApiRequestError)) {
    return `Unable to ${action}. Please try again.`
  }
  if (error.status === 401) return 'Your session expired. Sign in again.'
  if (error.status === 403) return 'You do not have permission to do this.'
  if (error.status === 404) return 'The requested ticket was not found.'
  if (error.status === 409 || error.status === 400) {
    return error.message.startsWith('API request failed')
      ? 'Review the ticket status and required fields, then try again.'
      : error.message
  }
  return `The API could not ${action}. Please try again.`
}
