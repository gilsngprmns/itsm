export const TICKET_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'PENDING',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
] as const

export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

export const TICKET_TYPES = ['INCIDENT', 'SERVICE_REQUEST'] as const
export type TicketType = (typeof TICKET_TYPES)[number]

export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export const TICKET_STATUS_TRANSITIONS: Record<
  TicketStatus,
  readonly TicketStatus[]
> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PENDING', 'RESOLVED', 'CANCELLED'],
  PENDING: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
  CANCELLED: [],
}

export function canTransitionTicket(
  current: TicketStatus,
  next: TicketStatus,
): boolean {
  return TICKET_STATUS_TRANSITIONS[current].includes(next)
}
