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

  const problem = window.prompt('What problem was observed or reported?')
  if (problem === null) return null
  const cause = window.prompt('What was the identified root cause?')
  if (cause === null) return null
  const actions = window.prompt('What actions were performed to solve it?')
  if (actions === null) return null
  const prevention = window.prompt(
    'What prevention or follow-up action is recommended?',
  )
  if (prevention === null) return null
  if (
    !problem.trim() ||
    !cause.trim() ||
    !actions.trim() ||
    !prevention.trim()
  ) {
    window.alert(
      'Problem, root cause, resolution actions, and prevention are required.',
    )
    return null
  }

  return {
    resolutionSummary: [
      `Problem: ${problem.trim()}`,
      `Root cause: ${cause.trim()}`,
      `Resolution actions: ${actions.trim()}`,
      `Prevention/follow-up: ${prevention.trim()}`,
    ].join('\n'),
  }
}
