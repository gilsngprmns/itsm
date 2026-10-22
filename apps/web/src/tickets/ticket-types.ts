export const TICKET_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'PENDING',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
] as const

export type TicketStatus = (typeof TICKET_STATUSES)[number]
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface TicketCategory {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
}

export interface Ticket {
  id: string
  ticketNumber: string
  subject: string
  description: string
  requester: { id: string; fullName: string }
  assignee: { id: string; fullName: string } | null
  category: { id: string; code: string; name: string } | null
  asset: { id: string; assetTag: string; name: string } | null
  location: { id: string; code: string; name: string } | null
  priority: TicketPriority
  status: TicketStatus
  resolutionSummary: string | null
  resolvedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TicketPage {
  items: Ticket[]
  page: number
  limit: number
  total: number
}

export interface TicketComment {
  id: string
  body: string
  isInternal: boolean
  author: { id: string; fullName: string }
  createdAt: string
}

export interface TicketHistory {
  statuses: Array<{
    previousStatus: string | null
    newStatus: string
    reason: string | null
    changedBy: string | null
    changedByName: string | null
    changedAt: string
  }>
  assignments: Array<{
    assigneeId: string
    assigneeName: string
    assignedBy: string | null
    assignedByName: string | null
    assignedAt: string
    unassignedAt: string | null
    reason: string | null
  }>
}

export const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PENDING', 'RESOLVED', 'CANCELLED'],
  PENDING: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
  CANCELLED: [],
}
