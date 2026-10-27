const successStatuses = new Set([
  'ASSIGNED',
  'AVAILABLE',
  'ACTIVE',
  'CLOSED',
  'RESOLVED',
])
const warningStatuses = new Set(['HIGH', 'IN_REPAIR', 'MEDIUM', 'PENDING'])
const dangerStatuses = new Set([
  'CANCELLED',
  'CRITICAL',
  'DAMAGED',
  'DISPOSED',
  'INACTIVE',
  'LOST',
])
const infoStatuses = new Set(['IN_PROGRESS', 'OPEN', 'RETIRED'])

export function statusLabel(value: string): string {
  if (value === 'RESOLVED') return 'Solved'
  if (value === 'CLOSED') return 'Closed / Done'
  const words = value.toLowerCase().split('_')
  return words
    .map((word, index) =>
      index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
    )
    .join(' ')
}

function statusTone(value: string): string {
  if (successStatuses.has(value)) return 'success'
  if (warningStatuses.has(value)) return 'warning'
  if (dangerStatuses.has(value)) return 'danger'
  if (infoStatuses.has(value)) return 'info'
  return 'neutral'
}

export function StatusBadge({ value }: { value: string }) {
  const tone = statusTone(value)

  return (
    <span className={`status-badge status-${tone}`}>
      <span aria-hidden="true" className="status-marker" />
      {statusLabel(value)}
    </span>
  )
}
