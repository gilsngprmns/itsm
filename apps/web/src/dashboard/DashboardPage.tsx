import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorBanner, LoadingState } from '../common/Feedback'
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
  const role = dashboardRole(user?.roles, user?.permissions)

  if (role === 'ADMIN' || role === 'AUDIT') {
    return <OperationsDashboard role={role} />
  }
  if (role === 'IT_SUPPORT') return <SupportDashboard />
  return <RequesterDashboard />
}

function SupportDashboard() {
  const { user } = useAuth()
  const canReadTickets = user?.permissions.includes('tickets.read.all') ?? false
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [ticketTotal, setTicketTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestSequence = useRef(0)
  const load = useCallback(async () => {
    const requestId = ++requestSequence.current
    setLoading(true)
    setError(null)
    if (!canReadTickets) {
      setTickets([])
      setTicketTotal(0)
      setError(
        'Your account does not have permission to view this information.',
      )
      setLoading(false)
      return
    }
    try {
      const result = await apiRequest<TicketPage>(
        'tickets?status=OPEN&limit=5&page=1',
      )
      if (requestId !== requestSequence.current) return
      setTickets(result.items)
      setTicketTotal(result.total)
    } catch (cause) {
      if (requestId === requestSequence.current) {
        setTickets([])
        setTicketTotal(0)
        setError(requestError(cause))
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false)
    }
  }, [canReadTickets])
  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])
  useEffect(
    () => () => {
      requestSequence.current += 1
    },
    [],
  )
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
          canReadTickets && (
            <Link
              className="button-link button-primary"
              to="/tickets?status=OPEN"
            >
              View ticket queue
            </Link>
          )
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
        <LoadingState message="Loading the ticket queue…" />
      ) : canReadTickets ? (
        <>
          <section aria-label="Support queue summary" className="metric-grid">
            <Metric
              hint="Across the full support queue"
              label="Open tickets"
              value={ticketTotal}
            />
            <Metric
              hint="Latest tickets shown below"
              label="Queue preview"
              value={tickets.length}
            />
          </section>
          {tickets.length === 0 ? (
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
                          <Link to={`/tickets/${ticket.id}`}>
                            {ticket.subject}
                          </Link>
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
        </>
      ) : null}
    </main>
  )
}

function OperationsDashboard({ role }: { role: 'ADMIN' | 'AUDIT' }) {
  const { user } = useAuth()
  const canAssign = user?.permissions.includes('tickets.assign') ?? false
  const canUpdateTickets = user?.permissions.includes('tickets.update') ?? false
  const canReadTickets = user?.permissions.includes('tickets.read.all') ?? false
  const canViewTickets =
    canReadTickets || (user?.permissions.includes('tickets.read.own') ?? false)
  const defaults = dateRangeDefaults()
  const [startDate, setStartDate] = useState(defaults.startDate)
  const [endDate, setEndDate] = useState(defaults.endDate)
  const [report, setReport] = useState<OperationalOverview | null>(null)
  const [openTickets, setOpenTickets] = useState<Ticket[]>([])
  const [ticketTotal, setTicketTotal] = useState(0)
  const [ticketQueueError, setTicketQueueError] = useState(false)
  const [assignees, setAssignees] = useState<
    Array<{ id: string; fullName: string }>
  >([])
  const [loading, setLoading] = useState(true)
  const requestSequence = useRef(0)
  const [savingTicketId, setSavingTicketId] = useState<string | null>(null)
  const [statusDrafts, setStatusDrafts] = useState<
    Record<string, TicketStatus>
  >({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current
    setLoading(true)
    setError(null)
    setReport(null)
    const params = new URLSearchParams({ startDate, endDate })
    try {
      const [reportResult, ticketResult, assigneeResult] =
        await Promise.allSettled([
          apiRequest<OperationalOverview>(`reports/overview?${params}`),
          role === 'ADMIN' && canReadTickets
            ? apiRequest<TicketPage>('tickets?status=OPEN&limit=5&page=1')
            : Promise.resolve(null),
          role === 'ADMIN' && canReadTickets && canAssign
            ? apiRequest<Array<{ id: string; fullName: string }>>(
                'tickets/assignees',
              )
            : Promise.resolve([]),
        ])
      if (requestId !== requestSequence.current) return
      const failures: string[] = []
      if (reportResult.status === 'fulfilled') {
        setReport(reportResult.value)
      } else {
        setReport(null)
        failures.push(requestError(reportResult.reason))
      }
      if (ticketResult.status === 'fulfilled') {
        setTicketQueueError(false)
        setOpenTickets(ticketResult.value?.items ?? [])
        setTicketTotal(ticketResult.value?.total ?? 0)
      } else {
        setTicketQueueError(true)
        setOpenTickets([])
        setTicketTotal(0)
        failures.push(`Open tickets: ${requestError(ticketResult.reason)}`)
      }
      if (assigneeResult.status === 'fulfilled') {
        setAssignees(assigneeResult.value)
      } else {
        setAssignees([])
        failures.push(`Assignees: ${requestError(assigneeResult.reason)}`)
      }
      setStatusDrafts({})
      setError(failures.length ? failures.join(' ') : null)
    } finally {
      if (requestId === requestSequence.current) setLoading(false)
    }
  }, [canAssign, canReadTickets, endDate, role, startDate])

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
    () => () => {
      requestSequence.current += 1
    },
    [],
  )

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
              {canViewTickets && (
                <Link className="button-link button-primary" to="/tickets">
                  View tickets
                </Link>
              )}
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
              {user?.permissions.includes('assets.create') &&
                user.permissions.includes('assets.read') && (
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
      {loading && <LoadingState message="Loading operational data…" />}
      {!loading && report && (
        <>
          {(role === 'ADMIN' || role === 'AUDIT') && (
            <section className="metric-grid" aria-label="Operational summary">
              {role === 'ADMIN' && canReadTickets && (
                <Metric
                  hint="Across the full current queue"
                  label="Open tickets"
                  value={ticketTotal}
                />
              )}
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
          {role === 'ADMIN' && canReadTickets && (
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
              {ticketQueueError ? (
                <EmptyState message="The open ticket queue could not be loaded." />
              ) : openTickets.length === 0 ? (
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
  const requestSequence = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.allSettled([
        canReadTickets
          ? apiRequest<TicketListResult>(
              'tickets?limit=5&sortBy=createdAt&sortOrder=desc',
            )
          : Promise.resolve(null),
        canReadAssets
          ? apiRequest<AssetListResult>(
              'assets?limit=5&sort=createdAt&order=desc',
            )
          : Promise.resolve(null),
      ])
      if (requestId !== requestSequence.current) return
      const [ticketResult, assetResult] = results
      const failures: Array<{ name: string; error: unknown }> = []
      if (ticketResult.status === 'fulfilled') {
        setTickets(ticketResult.value)
      } else {
        setTickets(null)
        failures.push({ name: 'tickets', error: ticketResult.reason })
      }
      if (assetResult.status === 'fulfilled') {
        setAssets(assetResult.value)
      } else {
        setAssets(null)
        failures.push({ name: 'assets', error: assetResult.reason })
      }
      setError(
        failures.length
          ? `Could not load your ${failures
              .map((failure) => failure.name)
              .join(' and ')}. ${requestError(failures[0].error)}`
          : null,
      )
    } finally {
      if (requestId === requestSequence.current) setLoading(false)
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
    () => () => {
      requestSequence.current += 1
    },
    [],
  )

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
        description="Track recent requests and the assets currently assigned to you."
        title="My tickets and assets"
        actions={
          canReadTickets && user?.permissions.includes('tickets.create') ? (
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
      {loading && <LoadingState message="Loading tickets and assets…" />}
      {!loading && (
        <>
          {(tickets || assets) && (
            <section aria-label="My workspace summary" className="metric-grid">
              {tickets && (
                <Metric
                  hint="Submitted by you"
                  label="My tickets"
                  value={tickets.total}
                />
              )}
              {assets && (
                <Metric
                  hint="Currently assigned to you"
                  label="My assets"
                  value={assets.total}
                />
              )}
            </section>
          )}
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
                  {canReadTickets &&
                    user?.permissions.includes('tickets.create') && (
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
          {!tickets && !assets && !error && (
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
