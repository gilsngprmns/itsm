import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorBanner } from '../common/Feedback'
import { StatusBadge, statusLabel } from '../common/StatusBadge'
import { formatDateTimeFull } from '../common/format'
import { PageHeader } from '../common/PageHeader'
import { ApiRequestError, apiRequest } from '../lib/api'
import {
  STATUS_TRANSITIONS,
  type Ticket,
  type TicketPage,
  type TicketStatus,
} from '../tickets/ticket-types'
import { dashboardRole } from './dashboard-role'
import type {
  AssetListResult,
  OperationalOverview,
  TicketListResult,
} from './report-types'
import {
  announceTicketChanged,
  onTicketChanged,
} from '../tickets/ticket-events'
import { requestTicketStatusChangeDetails } from '../tickets/status-change'
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
  const role = dashboardRole(user?.roles)

  if (role === 'ADMIN' || role === 'AUDIT') {
    return <OperationsDashboard role={role} />
  }
  if (role === 'IT_SUPPORT') return <SupportDashboard />
  return <RequesterDashboard />
}

function SupportDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      const result = await apiRequest<TicketPage>(
        'tickets?status=OPEN&limit=5&page=1',
      )
      setTickets(result.items)
      setError(null)
    } catch (cause) {
      setError(requestError(cause))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])
  useEffect(
    () =>
      onTicketChanged(() => {
        setLoading(true)
        void load()
      }),
    [load],
  )
  return (
    <main className="page management-page dashboard-page">
      <PageHeader
        className="dashboard-heading"
        description="Review incoming work and keep service operations moving."
        title="IT support queue"
        actions={
          <Link
            className="button-link button-primary"
            to="/tickets?status=OPEN"
          >
            View ticket queue
          </Link>
        }
      />
      {error && (
        <ErrorBanner className="dashboard-error">
          <span>{error}</span>
          <button onClick={() => void load()} type="button">
            Try again
          </button>
        </ErrorBanner>
      )}
      {loading ? (
        <p role="status">Loading the ticket queue…</p>
      ) : tickets.length === 0 ? (
        <EmptyState message="There are no open tickets." />
      ) : (
        <section
          className="report-panel"
          aria-labelledby="support-queue-heading"
        >
          <PanelHeading
            id="support-queue-heading"
            title="Open tickets"
            action={<Link to="/tickets?status=OPEN">View all</Link>}
          />
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Ticket</th>
                  <th scope="col">Type</th>
                  <th scope="col">Subject</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Assignee</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <Link to={`/tickets/${ticket.id}`}>
                        {ticket.ticketNumber}
                      </Link>
                    </td>
                    <td>
                      {ticket.type === 'SERVICE_REQUEST'
                        ? 'Service request'
                        : 'Incident'}
                    </td>
                    <td>
                      <Link to={`/tickets/${ticket.id}`}>{ticket.subject}</Link>
                    </td>
                    <td>
                      <StatusBadge value={ticket.priority} />
                    </td>
                    <td>{ticket.assignee?.fullName ?? 'Unassigned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}

function OperationsDashboard({ role }: { role: 'ADMIN' | 'AUDIT' }) {
  const { user } = useAuth()
  const canAssign = user?.permissions.includes('tickets.assign') ?? false
  const canUpdateTickets = user?.permissions.includes('tickets.update') ?? false
  const defaults = dateRangeDefaults()
  const [startDate, setStartDate] = useState(defaults.startDate)
  const [endDate, setEndDate] = useState(defaults.endDate)
  const [report, setReport] = useState<OperationalOverview | null>(null)
  const [openTickets, setOpenTickets] = useState<Ticket[]>([])
  const [assignees, setAssignees] = useState<
    Array<{ id: string; fullName: string }>
  >([])
  const [loading, setLoading] = useState(true)
  const [savingTicketId, setSavingTicketId] = useState<string | null>(null)
  const [statusDrafts, setStatusDrafts] = useState<
    Record<string, TicketStatus>
  >({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ startDate, endDate })
    try {
      const [result, ticketResult, assigneeResult] = await Promise.all([
        apiRequest<OperationalOverview>(`reports/overview?${params}`),
        role === 'ADMIN'
          ? apiRequest<TicketPage>('tickets?status=OPEN&limit=5&page=1')
          : Promise.resolve(null),
        role === 'ADMIN' && canAssign
          ? apiRequest<Array<{ id: string; fullName: string }>>(
              'tickets/assignees',
            )
          : Promise.resolve([]),
      ])
      setReport(result)
      setOpenTickets(ticketResult?.items ?? [])
      setStatusDrafts({})
      setAssignees(assigneeResult)
      setError(null)
    } catch (cause) {
      setError(requestError(cause))
    } finally {
      setLoading(false)
    }
  }, [canAssign, endDate, role, startDate])

  const changeTicketStatus = async (
    ticket: Ticket,
    nextStatus: TicketStatus,
  ) => {
    if (nextStatus === ticket.status) return
    const details = requestTicketStatusChangeDetails(nextStatus)
    if (!details) return

    setSavingTicketId(ticket.id)
    setError(null)
    setNotice(null)
    try {
      const updated = await apiRequest<Ticket>(`tickets/${ticket.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          ...details,
        }),
      })
      setOpenTickets((current) =>
        current.filter((item) => item.id !== updated.id),
      )
      announceTicketChanged(updated.id)
      setStatusDrafts((current) => ({
        ...current,
        [updated.id]: updated.status,
      }))
      setNotice(
        `${updated.ticketNumber} updated to ${statusLabel(updated.status)}.`,
      )
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError && [400, 409].includes(cause.status)
          ? cause.message
          : requestError(cause),
      )
    } finally {
      setSavingTicketId(null)
    }
  }

  const changeTicketAssignee = async (ticket: Ticket, assigneeId: string) => {
    if (assigneeId === (ticket.assignee?.id ?? '')) return
    setSavingTicketId(ticket.id)
    setError(null)
    setNotice(null)
    try {
      const updated = await apiRequest<Ticket>(
        `tickets/${ticket.id}/assignment`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assigneeId: assigneeId || null }),
        },
      )
      setOpenTickets((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      announceTicketChanged(updated.id)
      setNotice(`${updated.ticketNumber} assignment updated.`)
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError && [400, 409].includes(cause.status)
          ? cause.message
          : requestError(cause),
      )
    } finally {
      setSavingTicketId(null)
    }
  }

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void load()
    })
    return () => {
      active = false
    }
  }, [load])

  useEffect(
    () =>
      onTicketChanged(() => {
        setLoading(true)
        void load()
      }),
    [load],
  )

  const title = role === 'ADMIN' ? 'Operations overview' : 'Audit activity'
  const recentActivity = (
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
      <ActivityList items={report?.recentActivity ?? []} />
    </section>
  )

  return (
    <main className="page management-page dashboard-page">
      <PageHeader
        className="dashboard-heading"
        description={
          role === 'ADMIN'
            ? 'A clear view of ticket volume, asset inventory, and recent work.'
            : 'Review recent changes across tickets, assets, and user activity.'
        }
        title={title}
        actions={
          role === 'ADMIN' ? (
            <>
              <Link className="button-link button-primary" to="/tickets">
                View tickets
              </Link>
              {user?.permissions.includes('users.read') && (
                <Link className="button-link" to="/users">
                  Manage users
                </Link>
              )}
              {user?.permissions.some((permission) =>
                [
                  'assets.read',
                  'tickets.read.all',
                  'tickets.read.own',
                  'users.read',
                ].includes(permission),
              ) && (
                <Link className="button-link" to="/master-data">
                  Master data
                </Link>
              )}
              {user?.permissions.includes('assets.create') && (
                <Link className="button-link" to="/assets">
                  Asset CSV tools
                </Link>
              )}
            </>
          ) : role === 'AUDIT' ? (
            <Link className="button-link" to="/reports">
              View reports
            </Link>
          ) : undefined
        }
      />

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
        <ErrorBanner className="dashboard-error">
          <span>{error}</span>
          <button onClick={() => void load()} type="button">
            Try again
          </button>
        </ErrorBanner>
      )}
      {notice && (
        <p className="notice dashboard-notice" role="status">
          {notice}
        </p>
      )}
      {loading && <p role="status">Loading operational data…</p>}
      {!loading && report && (
        <>
          {role === 'ADMIN' && (
            <section className="metric-grid" aria-label="Operational summary">
              <Metric
                hint="Created in the selected period"
                label="Tickets created"
                value={report.tickets.totalCreated}
              />
              <Metric
                hint="Resolved in the selected period"
                label="Tickets resolved"
                value={report.tickets.resolvedInPeriod}
              />
              <Metric
                hint="Across all recorded locations"
                label="Assets tracked"
                value={report.assets.total}
              />
            </section>
          )}
          {role === 'ADMIN' && (
            <section
              aria-labelledby="open-tickets-heading"
              className="report-section"
            >
              <PanelHeading
                action={
                  <Link to="/tickets?status=OPEN">View open tickets</Link>
                }
                id="open-tickets-heading"
                title="Open tickets"
              />
              {openTickets.length === 0 ? (
                <EmptyState message="No open tickets." />
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Ticket</th>
                        <th scope="col">Subject</th>
                        <th scope="col">Priority</th>
                        <th scope="col">Requester</th>
                        <th scope="col">Status</th>
                        <th scope="col">Assigned to</th>
                        <th scope="col">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openTickets.map((ticket) => (
                        <tr key={ticket.id}>
                          <td>
                            <Link to={`/tickets/${ticket.id}`}>
                              {ticket.ticketNumber}
                            </Link>
                          </td>
                          <td>
                            <Link to={`/tickets/${ticket.id}`}>
                              {ticket.subject}
                            </Link>
                          </td>
                          <td>
                            <StatusBadge value={ticket.priority} />
                          </td>
                          <td>
                            {ticket.requester?.fullName ?? 'Unknown requester'}
                          </td>
                          <td>
                            {canUpdateTickets &&
                            STATUS_TRANSITIONS[ticket.status].length > 0 ? (
                              <div className="ticket-inline-control">
                                <select
                                  aria-label={`Status for ${ticket.ticketNumber}`}
                                  className="ticket-status-select"
                                  disabled={savingTicketId === ticket.id}
                                  onChange={(event) =>
                                    setStatusDrafts((current) => ({
                                      ...current,
                                      [ticket.id]: event.target
                                        .value as TicketStatus,
                                    }))
                                  }
                                  value={
                                    statusDrafts[ticket.id] ?? ticket.status
                                  }
                                >
                                  <option value={ticket.status}>
                                    {statusLabel(ticket.status)}
                                  </option>
                                  {STATUS_TRANSITIONS[ticket.status].map(
                                    (nextStatus) => (
                                      <option
                                        key={nextStatus}
                                        value={nextStatus}
                                      >
                                        {statusLabel(nextStatus)}
                                      </option>
                                    ),
                                  )}
                                </select>
                                <button
                                  disabled={
                                    savingTicketId === ticket.id ||
                                    (statusDrafts[ticket.id] ??
                                      ticket.status) === ticket.status
                                  }
                                  onClick={() =>
                                    void changeTicketStatus(
                                      ticket,
                                      statusDrafts[ticket.id] ?? ticket.status,
                                    )
                                  }
                                  type="button"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <StatusBadge value={ticket.status} />
                            )}
                          </td>
                          <td>
                            {canAssign ? (
                              <select
                                aria-label={`Assignee for ${ticket.ticketNumber}`}
                                className="ticket-assignee-select"
                                disabled={savingTicketId === ticket.id}
                                onChange={(event) =>
                                  void changeTicketAssignee(
                                    ticket,
                                    event.target.value,
                                  )
                                }
                                value={ticket.assignee?.id ?? ''}
                              >
                                <option value="">Unassigned</option>
                                {assignees.map((assignee) => (
                                  <option key={assignee.id} value={assignee.id}>
                                    {assignee.fullName}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              (ticket.assignee?.fullName ?? 'Unassigned')
                            )}
                          </td>
                          <td>
                            <time
                              dateTime={ticket.createdAt}
                              title={formatDateTimeFull(ticket.createdAt)}
                            >
                              {dateTimeLabel(ticket.createdAt)}
                            </time>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
          {role === 'AUDIT' && recentActivity}
          {role === 'ADMIN' && (
            <>
              <div className="dashboard-columns">
                <section
                  className="report-panel"
                  aria-labelledby="ticket-type-heading"
                >
                  <PanelHeading id="ticket-type-heading" title="Ticket type" />
                  <CountList
                    items={report.tickets.byType}
                    linkFor={(name) =>
                      `/tickets?type=${encodeURIComponent(name)}`
                    }
                  />
                </section>
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
                  <CountList
                    items={report.tickets.byStatus}
                    linkFor={(name) =>
                      `/tickets?status=${encodeURIComponent(name)}`
                    }
                  />
                </section>
                <section
                  className="report-panel"
                  aria-labelledby="ticket-priority-heading"
                >
                  <PanelHeading
                    id="ticket-priority-heading"
                    title="Priority breakdown"
                  />
                  <CountList
                    items={report.tickets.byPriority}
                    linkFor={(name) =>
                      `/tickets?priority=${encodeURIComponent(name)}`
                    }
                  />
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
                  <CountList
                    items={report.assets.byStatus}
                    linkFor={(name) =>
                      `/assets?status=${encodeURIComponent(name)}`
                    }
                  />
                </section>
              </div>
              {recentActivity}
            </>
          )}
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

  useEffect(
    () =>
      onTicketChanged(() => {
        setLoading(true)
        void load()
      }),
    [load],
  )

  return (
    <main className="page management-page dashboard-page">
      <PageHeader
        className="dashboard-heading"
        title="My tickets and assets"
        actions={
          user?.permissions.includes('tickets.create') ? (
            <Link className="button-link button-primary" to="/tickets?new=1">
              Create ticket
            </Link>
          ) : undefined
        }
      />
      {error && (
        <ErrorBanner className="dashboard-error">
          <span>{error}</span>
          <button onClick={() => void load()} type="button">
            Try again
          </button>
        </ErrorBanner>
      )}
      {loading && <p role="status">Loading tickets and assets…</p>}
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
                  <p>No tickets yet.</p>
                  {user?.permissions.includes('tickets.create') && (
                    <Link to="/tickets?new=1">Create ticket</Link>
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
                          <td>
                            <time
                              dateTime={ticket.updatedAt}
                              title={formatDateTimeFull(ticket.updatedAt)}
                            >
                              {dateTimeLabel(ticket.updatedAt)}
                            </time>
                          </td>
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
                <p className="empty-state">No assets are assigned to you.</p>
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
                          <td>{asset.category?.name ?? 'Uncategorized'}</td>
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
              No tickets or assets are available for this account.
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

export function Metric({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint?: string
}) {
  return (
    <div className="metric-panel">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value.toLocaleString()}</strong>
      {hint && <span className="metric-hint">{hint}</span>}
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
  linkFor,
}: {
  items: Array<{ name: string; count: number }>
  linkFor?: (name: string) => string
}) {
  if (!items.length)
    return <p className="empty-state">No data for this period.</p>
  return (
    <ul className="count-list">
      {items.map((item) => (
        <li key={item.name}>
          {linkFor ? (
            <Link to={linkFor(item.name)}>{readableLabel(item.name)}</Link>
          ) : (
            <span>{readableLabel(item.name)}</span>
          )}
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
          <div className="activity-copy">
            <strong>{readableLabel(item.action)}</strong>
            <span>{item.actor?.fullName ?? 'System'}</span>
            <span>
              {readableLabel(item.entityType)}
              {item.entityId ? ` reference ${item.entityId}` : ''}
            </span>
          </div>
          <time
            dateTime={item.createdAt}
            title={formatDateTimeFull(item.createdAt)}
          >
            {dateTimeLabel(item.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  )
}

export function StatusLabel({ value }: { value: string }) {
  return <StatusBadge value={value} />
}
