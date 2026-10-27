import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { EmptyState } from '../common/Feedback'
import { formatDateTime, formatDateTimeFull } from '../common/format'
import { PageHeader } from '../common/PageHeader'
import { StatusBadge, statusLabel } from '../common/StatusBadge'
import { apiRequest } from '../lib/api'
import { ticketErrorMessage } from './ticket-errors'
import { announceTicketChanged, onTicketChanged } from './ticket-events'
import { requestTicketStatusChangeDetails } from './status-change'
import {
  TICKET_STATUSES,
  TICKET_TYPES,
  STATUS_TRANSITIONS,
  type Ticket,
  type TicketCategory,
  type TicketPage,
  type TicketStatus,
} from './ticket-types'

interface AssetOption {
  id: string
  assetCode: string
  assetTag: string
  name: string
}

interface LocationOption {
  id: string
  code: string
  name: string
}

const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

export function TicketsPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const canCreate = user?.permissions.includes('tickets.create') ?? false
  const canReadAssets = user?.permissions.includes('assets.read') ?? false
  const canManageCategories =
    user?.permissions.includes('tickets.update') ?? false
  const canAssign = user?.permissions.includes('tickets.assign') ?? false
  const canUpdateStatus = user?.permissions.includes('tickets.update') ?? false
  const canUpdateAssignedStatus =
    user?.permissions.includes('tickets.update.assigned') ?? false
  const [items, setItems] = useState<Ticket[]>([])
  const [categories, setCategories] = useState<TicketCategory[]>([])
  const [assignees, setAssignees] = useState<
    Array<{ id: string; fullName: string }>
  >([])
  const [assets, setAssets] = useState<AssetOption[]>([])
  const [assetSearch, setAssetSearch] = useState('')
  const [assetPage, setAssetPage] = useState(1)
  const [assetTotal, setAssetTotal] = useState(0)
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchValue, setSearchValue] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '')
  const [priority, setPriority] = useState(
    () => searchParams.get('priority') ?? '',
  )
  const [type, setType] = useState(() => searchParams.get('type') ?? '')
  const [assignedToMe, setAssignedToMe] = useState(false)
  const [unassigned, setUnassigned] = useState(false)
  const canSupport = user?.permissions.includes('tickets.self_assign') ?? false
  const canFilterAssignments =
    canSupport || (user?.permissions.includes('tickets.assign') ?? false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingTicketId, setSavingTicketId] = useState<string | null>(null)
  const [statusDrafts, setStatusDrafts] = useState<
    Record<string, TicketStatus>
  >({})
  const [showCreate, setShowCreate] = useState(
    () => searchParams.get('new') === '1',
  )
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [newPriority, setNewPriority] =
    useState<(typeof priorities)[number]>('MEDIUM')
  const [assetId, setAssetId] = useState('')
  const [newType, setNewType] =
    useState<(typeof TICKET_TYPES)[number]>('INCIDENT')
  const [locationId, setLocationId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const pageCount = Math.max(1, Math.ceil(total / 25))
  const hasActiveFilters = Boolean(
    search || status || priority || type || assignedToMe || unassigned,
  )

  const loadTickets = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '25' })
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    if (priority) params.set('priority', priority)
    if (type) params.set('type', type)
    if (assignedToMe) params.set('assignedToMe', 'true')
    if (unassigned) params.set('unassigned', 'true')
    try {
      const [result, categoryResult] = await Promise.all([
        apiRequest<TicketPage>(`tickets?${params}`),
        apiRequest<TicketCategory[]>('ticket-categories'),
      ])
      setItems(result.items)
      setStatusDrafts({})
      setTotal(result.total)
      setCategories(categoryResult)
      if (canReadAssets)
        setLocations(await apiRequest<LocationOption[]>('locations'))
      setError(null)
    } catch (cause) {
      setError(ticketErrorMessage(cause, 'load tickets'))
    } finally {
      setLoading(false)
    }
  }, [
    page,
    search,
    status,
    priority,
    type,
    assignedToMe,
    unassigned,
    canReadAssets,
  ])

  useEffect(() => {
    if (!canCreate) return
    let active = true
    const params = new URLSearchParams({ page: String(assetPage), limit: '25' })
    if (assetSearch.trim()) params.set('search', assetSearch.trim())
    void apiRequest<{ items: AssetOption[]; total: number }>(
      `tickets/linkable-assets?${params}`,
    )
      .then((result) => {
        if (!active) return
        setAssets(result.items)
        setAssetTotal(result.total)
      })
      .catch((cause: unknown) => {
        if (!active) return
        setAssets([])
        setAssetTotal(0)
        setError(ticketErrorMessage(cause, 'load eligible assets'))
      })
    return () => {
      active = false
    }
  }, [canCreate, assetPage, assetSearch])

  useEffect(() => {
    if (!canAssign) return
    let active = true
    void apiRequest<Array<{ id: string; fullName: string }>>(
      'tickets/assignees',
    )
      .then((result) => {
        if (active) setAssignees(result)
      })
      .catch((cause: unknown) => {
        if (active) setError(ticketErrorMessage(cause, 'load ticket assignees'))
      })
    return () => {
      active = false
    }
  }, [canAssign])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void loadTickets()
    })
    return () => {
      active = false
    }
  }, [loadTickets])

  useEffect(
    () =>
      onTicketChanged(() => {
        setLoading(true)
        void loadTickets()
      }),
    [loadTickets],
  )

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setPage(1)
    setSearch(searchValue.trim())
  }

  const clearFilters = () => {
    setSearchValue('')
    setSearch('')
    setStatus('')
    setPriority('')
    setType('')
    setAssignedToMe(false)
    setUnassigned(false)
    setPage(1)
    setLoading(true)
  }

  const createTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const created = await apiRequest<Ticket>('tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          description,
          categoryId,
          type: newType,
          priority: newPriority,
          ...(assetId ? { assetId } : {}),
          ...(locationId ? { locationId } : {}),
        }),
      })
      setSubject('')
      setDescription('')
      setCategoryId('')
      setNewPriority('MEDIUM')
      setNewType('INCIDENT')
      setAssetId('')
      setLocationId('')
      setShowCreate(false)
      setPage(1)
      setSearch('')
      setSearchValue('')
      setNotice(`Ticket ${created.ticketNumber} created.`)
      setLoading(true)
      await loadTickets()
    } catch (cause) {
      setError(ticketErrorMessage(cause, 'create the ticket'))
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (ticket: Ticket, nextStatus: TicketStatus) => {
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
      announceTicketChanged(updated.id)
      setStatusDrafts((current) => ({
        ...current,
        [updated.id]: updated.status,
      }))
      setNotice(
        `${updated.ticketNumber} updated to ${statusLabel(nextStatus)}.`,
      )
    } catch (cause) {
      setError(ticketErrorMessage(cause, 'update ticket status'))
    } finally {
      setSavingTicketId(null)
    }
  }

  const changeAssignee = async (ticket: Ticket, assigneeId: string) => {
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
      announceTicketChanged(updated.id)
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      setNotice(`${updated.ticketNumber} assignment updated.`)
    } catch (cause) {
      setError(ticketErrorMessage(cause, 'update ticket assignment'))
    } finally {
      setSavingTicketId(null)
    }
  }

  const assignToMe = async (ticket: Ticket) => {
    setSavingTicketId(ticket.id)
    setError(null)
    setNotice(null)
    try {
      const updated = await apiRequest<Ticket>(
        `tickets/${ticket.id}/assign-to-me`,
        { method: 'POST' },
      )
      announceTicketChanged(updated.id)
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      setNotice(`${updated.ticketNumber} assigned to you.`)
    } catch (cause) {
      setError(ticketErrorMessage(cause, 'assign the ticket to yourself'))
    } finally {
      setSavingTicketId(null)
    }
  }

  return (
    <main className="page management-page">
      <PageHeader
        title="Tickets"
        actions={
          <>
            {canManageCategories && (
              <Link className="button-link" to="/ticket-categories">
                Manage categories
              </Link>
            )}
            {canCreate && (
              <button
                type="button"
                onClick={() => {
                  setShowCreate((current) => !current)
                  setError(null)
                }}
              >
                {showCreate ? 'Cancel' : 'Create ticket'}
              </button>
            )}
          </>
        }
      />

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}

      {showCreate && (
        <section className="form-panel" aria-labelledby="new-ticket-heading">
          <h2 id="new-ticket-heading">Create ticket</h2>
          <form className="form-grid" onSubmit={createTicket}>
            <label className="field-wide">
              Subject
              <input
                required
                maxLength={200}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </label>
            <label>
              Type
              <select
                value={newType}
                onChange={(event) =>
                  setNewType(
                    event.target.value as (typeof TICKET_TYPES)[number],
                  )
                }
              >
                {TICKET_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value === 'SERVICE_REQUEST'
                      ? 'Service request'
                      : 'Incident'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select
                required
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select
                value={newPriority}
                onChange={(event) =>
                  setNewPriority(
                    event.target.value as (typeof priorities)[number],
                  )
                }
              >
                {priorities.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            {canCreate && (
              <>
                <label>
                  Search eligible assets
                  <input
                    maxLength={100}
                    value={assetSearch}
                    onChange={(event) => {
                      setAssetSearch(event.target.value)
                      setAssetPage(1)
                    }}
                    placeholder="Asset code, tag, or name"
                  />
                </label>
                <label>
                  Related asset (optional)
                  <select
                    value={assetId}
                    onChange={(event) => setAssetId(event.target.value)}
                  >
                    <option value="">No related asset</option>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.assetCode} · {asset.assetTag} ({asset.name})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="field-wide pagination">
                  <button
                    disabled={assetPage <= 1}
                    onClick={() => setAssetPage((page) => page - 1)}
                    type="button"
                  >
                    Previous assets
                  </button>
                  <span>{assetTotal} eligible assets</span>
                  <button
                    disabled={assetPage * 25 >= assetTotal}
                    onClick={() => setAssetPage((page) => page + 1)}
                    type="button"
                  >
                    Next assets
                  </button>
                </div>
              </>
            )}
            {canReadAssets && (
              <label>
                Location (optional)
                <select
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                >
                  <option value="">No location</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.code} ({location.name})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field-wide">
              Description
              <textarea
                required
                maxLength={10_000}
                rows={5}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <div className="field-wide">
              <button
                type="submit"
                disabled={saving || categories.length === 0}
              >
                {saving ? 'Creating ticket…' : 'Create ticket'}
              </button>
              {categories.length === 0 && (
                <p role="status">
                  No active ticket categories are available.
                  {canManageCategories && (
                    <>
                      {' '}
                      <Link to="/ticket-categories">Manage categories</Link>.
                    </>
                  )}
                </p>
              )}
            </div>
          </form>
        </section>
      )}

      <section
        className="ticket-toolbar"
        aria-labelledby="ticket-filters-heading"
      >
        <div className="ticket-toolbar-heading">
          <div>
            <h2 id="ticket-filters-heading">Find a ticket</h2>
            <p>Search and narrow the list by type, status, or priority.</p>
          </div>
          {hasActiveFilters && (
            <button
              className="text-button"
              onClick={clearFilters}
              type="button"
            >
              Clear filters
            </button>
          )}
        </div>
        <form className="ticket-search" onSubmit={submitSearch} role="search">
          <label htmlFor="ticket-search">Ticket number or subject</label>
          <div className="ticket-search-controls">
            <input
              id="ticket-search"
              value={searchValue}
              maxLength={100}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="e.g. TCK-2026-00001"
            />
            <button type="submit">Search</button>
          </div>
        </form>
        <div className="filter-form ticket-filters" aria-label="Ticket filters">
          <label>
            Type
            <select
              value={type}
              onChange={(event) => {
                setPage(1)
                setType(event.target.value)
                setLoading(true)
              }}
            >
              <option value="">All types</option>
              {TICKET_TYPES.map((value) => (
                <option key={value} value={value}>
                  {value === 'SERVICE_REQUEST' ? 'Service request' : 'Incident'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(event) => {
                setPage(1)
                setStatus(event.target.value)
                setLoading(true)
              }}
            >
              <option value="">All statuses</option>
              {TICKET_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </select>
          </label>
          {canFilterAssignments && (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={assignedToMe}
                onChange={(event) => {
                  setPage(1)
                  setAssignedToMe(event.target.checked)
                  if (event.target.checked) setUnassigned(false)
                  setLoading(true)
                }}
              />
              Assigned to me
            </label>
          )}
          {canFilterAssignments && (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={unassigned}
                onChange={(event) => {
                  setPage(1)
                  setUnassigned(event.target.checked)
                  if (event.target.checked) setAssignedToMe(false)
                  setLoading(true)
                }}
              />
              Unassigned
            </label>
          )}
          <label>
            Priority
            <select
              value={priority}
              onChange={(event) => {
                setPage(1)
                setPriority(event.target.value)
                setLoading(true)
              }}
            >
              <option value="">All priorities</option>
              {priorities.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {loading ? (
        <p role="status">Loading tickets…</p>
      ) : items.length === 0 ? (
        <EmptyState
          message="No tickets found for these filters."
          action={
            canCreate ? (
              <button
                className="text-button"
                onClick={() => setShowCreate(true)}
                type="button"
              >
                Create ticket
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="table-scroll">
          <table className="data-table ticket-table">
            <thead>
              <tr>
                <th scope="col">Ticket</th>
                <th scope="col">Status</th>
                <th scope="col">Priority</th>
                <th scope="col">Category</th>
                <th scope="col">Requester</th>
                <th scope="col">Assigned to</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <div className="ticket-summary-cell">
                      <Link
                        className="ticket-subject-link"
                        to={`/tickets/${ticket.id}`}
                      >
                        {ticket.subject}
                      </Link>
                      <span className="ticket-reference">
                        {ticket.ticketNumber}
                      </span>
                      <span className="ticket-type-label">
                        {ticket.type === 'SERVICE_REQUEST'
                          ? 'Service request'
                          : 'Incident'}
                      </span>
                    </div>
                  </td>
                  <td>
                    {(() => {
                      const canChangeStatus =
                        canUpdateStatus ||
                        (canUpdateAssignedStatus &&
                          ticket.assignee?.id === user?.id)
                      const nextStatuses = STATUS_TRANSITIONS[ticket.status]
                      return canChangeStatus && nextStatuses.length > 0 ? (
                        <div className="ticket-inline-control">
                          <select
                            aria-label={`Status for ${ticket.ticketNumber}`}
                            className="ticket-status-select"
                            disabled={savingTicketId === ticket.id}
                            onChange={(event) =>
                              setStatusDrafts((current) => ({
                                ...current,
                                [ticket.id]: event.target.value as TicketStatus,
                              }))
                            }
                            value={statusDrafts[ticket.id] ?? ticket.status}
                          >
                            <option value={ticket.status}>
                              {statusLabel(ticket.status)}
                            </option>
                            {nextStatuses.map((nextStatus) => (
                              <option key={nextStatus} value={nextStatus}>
                                {statusLabel(nextStatus)}
                              </option>
                            ))}
                          </select>
                          <button
                            disabled={
                              savingTicketId === ticket.id ||
                              (statusDrafts[ticket.id] ?? ticket.status) ===
                                ticket.status
                            }
                            onClick={() =>
                              void changeStatus(
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
                      )
                    })()}
                  </td>
                  <td>
                    <StatusBadge value={ticket.priority} />
                  </td>
                  <td>{ticket.category?.name ?? 'Uncategorized'}</td>
                  <td>{ticket.requester?.fullName ?? 'Unknown requester'}</td>
                  <td>
                    {canAssign ? (
                      <select
                        aria-label={`Assignee for ${ticket.ticketNumber}`}
                        className="ticket-assignee-select"
                        disabled={
                          savingTicketId === ticket.id ||
                          ticket.status === 'CLOSED' ||
                          ticket.status === 'CANCELLED'
                        }
                        onChange={(event) =>
                          void changeAssignee(ticket, event.target.value)
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
                      <>
                        {ticket.assignee?.fullName ?? 'Unassigned'}
                        {canSupport &&
                          !ticket.assignee &&
                          ticket.status !== 'CLOSED' &&
                          ticket.status !== 'CANCELLED' && (
                            <button
                              className="text-button ticket-assign-self"
                              disabled={savingTicketId === ticket.id}
                              onClick={() => void assignToMe(ticket)}
                              type="button"
                            >
                              Assign to me
                            </button>
                          )}
                      </>
                    )}
                  </td>
                  <td>
                    <time
                      dateTime={ticket.createdAt}
                      title={formatDateTimeFull(ticket.createdAt)}
                    >
                      {formatDateTime(ticket.createdAt)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > 0 && (
        <nav className="pagination" aria-label="Ticket pages">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              setPage((value) => value - 1)
              setLoading(true)
            }}
          >
            Previous page
          </button>
          <span>
            Showing {(page - 1) * 25 + 1} to {Math.min(page * 25, total)} of{' '}
            {total} tickets
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => {
              setPage((value) => value + 1)
              setLoading(true)
            }}
          >
            Next page
          </button>
        </nav>
      )}
    </main>
  )
}
