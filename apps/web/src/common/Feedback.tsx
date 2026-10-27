import type { ReactNode } from 'react'

export function EmptyState({
  message,
  action,
}: {
  message: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <p>{message}</p>
      {action}
    </div>
  )
}

export function ErrorBanner({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={className ? `error-banner ${className}` : 'error-banner'}
      role="alert"
    >
      {children}
    </div>
  )
}
