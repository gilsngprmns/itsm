import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={className ? `page-header ${className}` : 'page-header'}>
      <div>
        <h1>{title}</h1>
        {description && <p className="intro">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}
