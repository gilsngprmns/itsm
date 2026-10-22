import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { apiRequest } from '../lib/api'
import { ticketErrorMessage } from './ticket-errors'
import {
  TICKET_STATUSES,
  type Ticket,
  type TicketCategory,
  type TicketPage,
} from './ticket-types'

interface AssetOption {
  id: string
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
  const [items, setItems] = useState<Ticket[]>([])
  const [categories, setCategories] = useState<TicketCategory[]>([])
  const [assets, setAssets] = useState<AssetOption[]>([])
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchValue, setSearchValue] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(
    () => searchParams.get('new') === '1',
  )
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [newPriority, setNewPriority] =
    useState<(typeof priorities)[number]>('MEDIUM')
  const [assetId, setAssetId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const pageCount = Math.max(1, Math.ceil(total / 25))

  const loadTickets = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '25' })
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    if (priority) params.set('priority', priority)
    try {
      const [result, categoryResult] = await Promise.all([
        apiRequest<TicketPage>(`tickets?${params}`),
        apiRequest<TicketCategory[]>('ticket-categories'),
      ])
      setItems(result.items)
      setTotal(result.total)
      setCategories(categoryResult)
      if (canReadAssets) {
        const [assetResult, locationResult] = await Promise.all([
          apiRequest<{ items: AssetOption[] }>('assets?limit=100'),
          apiRequest<LocationOption[]>('locations'),
        ])
        setAssets(assetResult.items)
        setLocations(locationResult)
      }
      setError(null)
    } catch (cause) {
      setError(ticketErrorMessage(cause, 'load tickets'))
    } finally {
      setLoading(false)
    }
  }, [page, search, status, priority, canReadAssets])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void loadTickets()
    })
    return () => {
      active = false
    }
  }, [loadTickets])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setPage(1)
    setSearch(searchValue.trim())
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
          priority: newPriority,
          ...(assetId ? { assetId } : {}),
          ...(locationId ? { locationId } : {}),
        }),
      })
      setSubject('')
      setDescription('')
      setCategoryId('')
      setNewPriority('MEDIUM')
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

  return (
    <main className="page management-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Service desk</p>
          <h1>Tickets</h1>
          <p className="intro">Track service requests and incidents.</p>
        </div>
        <div className="page-actions">
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
              {showCreate ? 'Cancel' : 'New ticket'}
            </button>
          )}
        </div>
      </header>

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
            {canReadAssets && (
              <>
                <label>
                  Related asset (optional)
                  <select
                    value={assetId}
                    onChange={(event) => setAssetId(event.target.value)}
                  >
                    <option value="">No related asset</option>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.assetTag} — {asset.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Location (optional)
                  <select
                    value={locationId}
                    onChange={(event) => setLocationId(event.target.value)}
                  >
                    <option value="">No location</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.code} — {location.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
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
                {saving ? 'Submitting…' : 'Submit ticket'}
              </button>
              {categories.length === 0 && (
                <p role="status">No active ticket categories are available.</p>
              )}
            </div>
          </form>
        </section>
      )}

      <form className="search-form" onSubmit={submitSearch}>
        <label>
          Search
          <input
            value={searchValue}
            maxLength={100}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Ticket number or subject"
          />
        </label>
        <button type="submit">Search</button>
      </form>
      <div className="filter-form" aria-label="Ticket filters">
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
                {value.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
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

      {loading ? (
        <p role="status">Loading tickets…</p>
      ) : items.length === 0 ? (
        <p className="empty-state">No tickets match these filters.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Ticket</th>
                <th scope="col">Subject</th>
                <th scope="col">Status</th>
                <th scope="col">Priority</th>
                <th scope="col">Category</th>
                <th scope="col">Requester</th>
                <th scope="col">Assignee</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <Link to={`/tickets/${ticket.id}`}>
                      {ticket.ticketNumber}
                    </Link>
                  </td>
                  <td>
                    <Link to={`/tickets/${ticket.id}`}>{ticket.subject}</Link>
                  </td>
                  <td>
                    <span className="status-pill">
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{ticket.priority}</td>
                  <td>{ticket.category?.name ?? '—'}</td>
                  <td>{ticket.requester.fullName}</td>
                  <td>{ticket.assignee?.fullName ?? 'Unassigned'}</td>
                  <td>{new Date(ticket.createdAt).toLocaleDateString()}</td>
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
            Previous
          </button>
          <span>
            Page {page} of {pageCount} ({total} tickets)
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => {
              setPage((value) => value + 1)
              setLoading(true)
            }}
          >
            Next
          </button>
        </nav>
      )}
    </main>
  )
}
