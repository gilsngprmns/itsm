import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiRequestError, apiRequest } from '../lib/api'
import type { AuditListResult } from './report-types'
import { dateTimeLabel, readableLabel } from './report-utils'

export function AuditLogsPage() {
  const [items, setItems] = useState<AuditListResult['items']>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageCount = Math.max(1, Math.ceil(total / 25))

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: '25',
      sortOrder: 'desc',
    })
    if (search) params.set('search', search)
    if (action) params.set('action', action)
    try {
      const result = await apiRequest<AuditListResult>(`audit-logs?${params}`)
      setItems(result.items)
      setTotal(result.total)
      setError(null)
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError && cause.status === 403
          ? 'Your account does not have permission to view audit events.'
          : 'Unable to load audit events.',
      )
    } finally {
      setLoading(false)
    }
  }, [action, page, search])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void load()
    })
    return () => {
      active = false
    }
  }, [load])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setLoading(true)
    setSearch(searchInput.trim())
  }

  return (
    <main className="page management-page dashboard-page">
      <header className="page-header dashboard-heading">
        <div>
          <p className="eyebrow">Read only</p>
          <h1>Audit log</h1>
          <p className="intro">
            Server-recorded administrative and operational activity.
          </p>
        </div>
      </header>
      <div className="audit-toolbar">
        <form className="search-form" onSubmit={submitSearch}>
          <label>
            Search activity
            <input
              maxLength={100}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Action, user, entity, or reference"
              value={searchInput}
            />
          </label>
          <button type="submit">Search</button>
        </form>
        <label className="audit-action-filter">
          Event type
          <select
            onChange={(event) => {
              setPage(1)
              setLoading(true)
              setAction(event.target.value)
            }}
            value={action}
          >
            <option value="">All events</option>
            <option value="auth.login.succeeded">Successful sign in</option>
            <option value="auth.login.failed">Failed sign in</option>
            <option value="tickets.created">Ticket created</option>
            <option value="assets.created">Asset created</option>
            <option value="users.role_changed">Role changed</option>
          </select>
        </label>
      </div>
      {error && (
        <div className="error-banner dashboard-error" role="alert">
          <span>{error}</span>
          <button onClick={() => void load()} type="button">
            Retry
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">Loading audit activity…</p>
      ) : items.length === 0 ? (
        <p className="empty-state">No audit events match these filters.</p>
      ) : (
        <div className="table-scroll audit-table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Actor</th>
                <th scope="col">Action</th>
                <th scope="col">Entity</th>
                <th scope="col">Reference</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <time dateTime={item.createdAt}>
                      {dateTimeLabel(item.createdAt)}
                    </time>
                  </td>
                  <td>{item.actor?.fullName ?? 'System / unknown'}</td>
                  <td>{readableLabel(item.action)}</td>
                  <td>{readableLabel(item.entityType)}</td>
                  <td className="reference-cell">
                    {item.entityId?.slice(0, 8) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && total > 0 && (
        <nav aria-label="Audit log pages" className="pagination">
          <button
            disabled={page <= 1}
            onClick={() => {
              setPage((current) => current - 1)
              setLoading(true)
            }}
            type="button"
          >
            Previous
          </button>
          <span>
            Page {page} of {pageCount} · {total} events
          </span>
          <button
            disabled={page >= pageCount}
            onClick={() => {
              setPage((current) => current + 1)
              setLoading(true)
            }}
            type="button"
          >
            Next
          </button>
        </nav>
      )}
    </main>
  )
}
