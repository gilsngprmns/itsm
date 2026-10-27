import { formatDate, formatDateTime } from '../common/format'
import { statusLabel } from '../common/StatusBadge'
import { TICKET_STATUSES } from '../tickets/ticket-types'

export function dateRangeDefaults(): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 29)
  return {
    startDate: toDateInput(start),
    endDate: toDateInput(end),
  }
}

function toDateInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export function dateLabel(value: string): string {
  return formatDate(value)
}

export function dateTimeLabel(value: string): string {
  return formatDateTime(value)
}

export function readableLabel(value: string): string {
  if ((TICKET_STATUSES as readonly string[]).includes(value)) {
    return statusLabel(value)
  }
  return value
    .toLowerCase()
    .split('_')
    .map((word, index) =>
      index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
    )
    .join(' ')
}
