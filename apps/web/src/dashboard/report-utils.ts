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
  return new Date(value).toLocaleDateString()
}

export function dateTimeLabel(value: string): string {
  return new Date(value).toLocaleString()
}

export function readableLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
