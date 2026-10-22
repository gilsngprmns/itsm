import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiRequestError, apiRequest } from '../lib/api'
import type {
  AssetListResult,
  OperationalOverview,
  TicketListResult,
} from './report-types'
import { dateRangeDefaults, dateTimeLabel, readableLabel } from './report-utils'

function requestError(error: unknown): string {
  if (error instanceof ApiRequestError && error.status === 403) {
    return 'Your account does not have permission to view this information.'
  }
  if (error instanceof ApiRequestError && error.status === 401) {
    return 'Your session expired. Sign in again.'
  }
  return 'The dashboard could not load data from the API.'
}

export function DashboardPage() {
  const { user } = useAuth()
  const role = user?.roles.includes('ADMIN')
    ? 'ADMIN'
    : user?.roles.includes('AUDIT')
      ? 'AUDIT'
      : 'USER'

  if (role === 'ADMIN' || role === 'AUDIT') {
    return <OperationsDashboard role={role} />
  }
  return <RequesterDashboard />
}

function OperationsDashboard({ role }: { role: 'ADMIN' | 'AUDIT' }) {
  const { user } = useAuth()
  const defaults = dateRangeDefaults()
  const [startDate, setStartDate] = useState(defaults.startDate)
  const [endDate, setEndDate] = useState(defaults.endDate)
  const [report, setReport] = useState<OperationalOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ startDate, endDate })
    try {
      const result = await apiRequest<OperationalOverview>(
        `reports/overview?${params}`,
      )
      setReport(result)
      setError(null)
    } catch (cause) {
      setError(requestError(cause))
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void load()
    })
    return () => {
      active = false
    }
  }, [load])

  const title = role === 'ADMIN' ? 'Operations dashboard' : 'Audit dashboard'

  return (
    <main className="page management-page dashboard-page">
      <header className="page-header dashboard-heading">
        <div>
          <p className="eyebrow">
            {role === 'ADMIN' ? 'Workspace' : 'Read only'}
          </p>
          <h1>{title}</h1>
          <p className="intro">Welcome back, {user?.fullName}.</p>
        </div>
        {role === 'ADMIN' && (
          <div className="page-actions">
            <Link className="button-link button-primary" to="/tickets">
              View tickets
            </Link>
            {user?.permissions.includes('users.read') && (
              <Link className="button-link" to="/users">
                Manage users
              </Link>
            )}
          </div>
        )}
      </header>

      <DateFilter
        endDate={endDate}
        onEndDateChange={(value) => {
          setLoading(true)
          setEndDate(value)
        }}
        onStartDateChange={(value) => {
          setLoading(true)
          setStartDate(value)
        }}
        startDate={startDate}
      />
      {error && (
        <div className="error-banner dashboard-error" role="alert">
          <span>{error}</span>
          <button onClick={() => void load()} type="button">
            Retry
          </button>
        </div>
      )}
      {loading && <p role="status">Loading operational data…</p>}
      {!loading && report && (
        <>
          <section aria-label="Operational totals" className="metric-grid">
            <Metric
              label="Tickets created in period"
              value={report.tickets.totalCreated}
            />
            <Metric
              label="Resolved in period"
              value={report.tickets.resolvedInPeriod}
            />
            <Metric label="Assets in inventory" value={report.assets.total} />
            <Metric
              label="Open (created in period)"
              value={
                report.tickets.byStatus.find((item) => item.name === 'OPEN')
                  ?.count ?? 0
              }
            />
          </section>
          <div className="dashboard-columns">
            <section
              className="report-panel"
              aria-labelledby="ticket-status-heading"
            >
              <PanelHeading
                action={
                  role === 'ADMIN' ? (
                    <Link to="/tickets">All tickets</Link>
                  ) : undefined
                }
                id="ticket-status-heading"
                title="Ticket status"
              />
              <CountList items={report.tickets.byStatus} />
            </section>
            <section
              className="report-panel"
              aria-labelledby="ticket-priority-heading"
            >
              <PanelHeading
                id="ticket-priority-heading"
                title="Priority breakdown"
              />
              <CountList items={report.tickets.byPriority} />
            </section>
            <section
              className="report-panel"
              aria-labelledby="asset-status-heading"
            >
              <PanelHeading
                action={
                  user?.permissions.includes('assets.read') ? (
                    <Link to="/assets">Inventory</Link>
                  ) : undefined
                }
                id="asset-status-heading"
                title="Asset status"
              />
              <CountList items={report.assets.byStatus} />
            </section>
          </div>
          <section
            className="report-panel activity-panel"
            aria-labelledby="recent-activity-heading"
          >
            <PanelHeading
              action={
                user?.permissions.includes('audit.read') ? (
                  <Link to="/audit-logs">View audit log</Link>
                ) : undefined
              }
              id="recent-activity-heading"
              title="Recent activity"
            />
            <ActivityList items={report.recentActivity} />
          </section>
        </>
      )}
    </main>
  )
}

function RequesterDashboard() {
  const { user } = useAuth()
  const canReadTickets = user?.permissions.includes('tickets.read.own') ?? false
  const canReadAssets = user?.permissions.includes('assets.read') ?? false
  const [tickets, setTickets] = useState<TicketListResult | null>(null)
  const [assets, setAssets] = useState<AssetListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const requests: Array<Promise<unknown>> = []
    if (canReadTickets) {
      requests.push(
        apiRequest<TicketListResult>(
          'tickets?limit=5&sortBy=createdAt&sortOrder=desc',
        ),
      )
    }
    if (canReadAssets) {
      requests.push(
        apiRequest<AssetListResult>('assets?limit=5&sort=createdAt&order=desc'),
      )
    }
    try {
      let index = 0
      const ticketResult = canReadTickets
        ? ((await requests[index++]) as TicketListResult)
        : null
      const assetResult = canReadAssets
        ? ((await requests[index]) as AssetListResult)
        : null
      setTickets(ticketResult)
      setAssets(assetResult)
      setError(null)
    } catch (cause) {
      setError(requestError(cause))
    } finally {
      setLoading(false)
    }
  }, [canReadAssets, canReadTickets])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void load()
    })
    return () => {
      active = false
    }
  }, [load])

  return (
    <main className="page management-page dashboard-page">
      <header className="page-header dashboard-heading">
        <div>
          <p className="eyebrow">My workspace</p>
          <h1>Hello, {user?.fullName}</h1>
          <p className="intro">Your service requests and assigned assets.</p>
        </div>
        {user?.permissions.includes('tickets.create') && (
          <Link className="button-link button-primary" to="/tickets?new=1">
            Create a ticket
          </Link>
        )}
      </header>
      {error && (
        <div className="error-banner dashboard-error" role="alert">
          <span>{error}</span>
          <button onClick={() => void load()} type="button">
            Retry
          </button>
        </div>
      )}
      {loading && <p role="status">Loading your workspace…</p>}
      {!loading && (
        <>
          {tickets && (
            <section
              className="report-panel"
              aria-labelledby="my-tickets-heading"
            >
              <PanelHeading
                action={<Link to="/tickets">View all tickets</Link>}
                id="my-tickets-heading"
                title="My recent tickets"
              />
              {tickets.items.length === 0 ? (
                <div className="empty-state">
                  <p>You have not submitted any tickets yet.</p>
                  {user?.permissions.includes('tickets.create') && (
                    <Link to="/tickets?new=1">Create your first ticket</Link>
                  )}
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Ticket</th>
                        <th scope="col">Subject</th>
                        <th scope="col">Status</th>
                        <th scope="col">Priority</th>
                        <th scope="col">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.items.map((ticket) => (
                        <tr key={ticket.id}>
                          <td>
                            <Link to={`/tickets/${ticket.id}`}>
                              {ticket.ticketNumber}
                            </Link>
                          </td>
                          <td>{ticket.subject}</td>
                          <td>
                            <StatusLabel value={ticket.status} />
                          </td>
                          <td>
                            <StatusLabel value={ticket.priority} />
                          </td>
                          <td>{dateTimeLabel(ticket.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
          {assets && (
            <section
              className="report-panel"
              aria-labelledby="my-assets-heading"
            >
              <PanelHeading
                action={<Link to="/assets">View assigned assets</Link>}
                id="my-assets-heading"
                title="My assigned assets"
              />
              {assets.items.length === 0 ? (
                <p className="empty-state">
                  No assets are currently assigned to you.
                </p>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Asset tag</th>
                        <th scope="col">Name</th>
                        <th scope="col">Category</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.items.map((asset) => (
                        <tr key={asset.id}>
                          <td>
                            <Link to={`/assets/${asset.id}`}>
                              {asset.assetTag}
                            </Link>
                          </td>
                          <td>{asset.name}</td>
                          <td>{asset.category.name}</td>
                          <td>
                            <StatusLabel value={asset.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
          {!tickets && !assets && (
            <p className="empty-state">
              No personal workspace data is available for this account.
            </p>
          )}
        </>
      )}
    </main>
  )
}

export function DateFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: {
  startDate: string
  endDate: string
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
}) {
  return (
    <form
      className="filter-form report-filter"
      onSubmit={(event) => event.preventDefault()}
    >
      <label>
        Start date
        <input
          max={endDate}
          onChange={(event) => onStartDateChange(event.target.value)}
          type="date"
          value={startDate}
        />
      </label>
      <label>
        End date
        <input
          min={startDate}
          onChange={(event) => onEndDateChange(event.target.value)}
          type="date"
          value={endDate}
        />
      </label>
      <span className="filter-hint">End date is inclusive.</span>
    </form>
  )
}

export function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-panel">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value.toLocaleString()}</strong>
    </div>
  )
}

export function PanelHeading({
  id,
  title,
  action,
}: {
  id: string
  title: string
  action?: ReactNode
}) {
  return (
    <header className="report-panel-heading">
      <h2 id={id}>{title}</h2>
      {action}
    </header>
  )
}

export function CountList({
  items,
}: {
  items: Array<{ name: string; count: number }>
}) {
  const maximum = Math.max(1, ...items.map((item) => item.count))
  if (!items.length)
    return <p className="empty-state">No data for this period.</p>
  return (
    <ul className="count-list">
      {items.map((item) => (
        <li key={item.name}>
          <span>{readableLabel(item.name)}</span>
          <progress
            aria-label={`${readableLabel(item.name)}: ${item.count}`}
            max={maximum}
            value={item.count}
          />
          <strong>{item.count}</strong>
        </li>
      ))}
    </ul>
  )
}

export function ActivityList({
  items,
}: {
  items: Array<{
    id: string
    action: string
    entityType: string
    entityId: string | null
    createdAt: string
    actor: { fullName: string } | null
  }>
}) {
  if (!items.length) return <p className="empty-state">No recent activity.</p>
  return (
    <ol className="activity-list">
      {items.map((item) => (
        <li key={item.id}>
          <span aria-hidden="true" className="activity-marker" />
          <div className="activity-copy">
            <strong>{readableLabel(item.action)}</strong>
            <span>
              {item.actor?.fullName ?? 'System'} ·{' '}
              {readableLabel(item.entityType)}
              {item.entityId ? ` · ${item.entityId.slice(0, 8)}` : ''}
            </span>
          </div>
          <time dateTime={item.createdAt}>{dateTimeLabel(item.createdAt)}</time>
        </li>
      ))}
    </ol>
  )
}

export function StatusLabel({ value }: { value: string }) {
  return (
    <span className={`status-pill status-${value.toLowerCase()}`}>
      {readableLabel(value)}
    </span>
  )
}
