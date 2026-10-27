import type { TicketStatus } from './ticket-types'

export interface TicketStatusChangeDetails {
  resolutionSummary?: string
}

export function requestTicketStatusChangeDetails(
  status: TicketStatus,
): TicketStatusChangeDetails | null {
  if (
    status === 'CANCELLED' &&
    !window.confirm('Cancel this ticket? This action cannot be undone.')
  ) {
    return null
  }

  if (status !== 'RESOLVED') return {}

  const resolutionSummary = window.prompt(
    'Enter a summary of how this ticket was solved.',
  )
  if (resolutionSummary === null) return null
  if (!resolutionSummary.trim()) {
    window.alert(
      'A solution summary is required to mark this ticket as solved.',
    )
    return null
  }

  return { resolutionSummary: resolutionSummary.trim() }
}
