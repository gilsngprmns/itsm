import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { EmptyState, ErrorBanner } from '../common/Feedback'
import { formatDateTimeFull } from '../common/format'
import { PageHeader } from '../common/PageHeader'
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
          : 'Audit events could not be loaded. Try again.',
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
      <PageHeader title="Audit log" />
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
        <ErrorBanner className="dashboard-error">
          <span>{error}</span>
          <button onClick={() => void load()} type="button">
            Try again
          </button>
        </ErrorBanner>
      )}
      {loading ? (
        <p role="status">Loading audit activity…</p>
      ) : items.length === 0 ? (
        <EmptyState message="No audit events found. Change the filters or search terms." />
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
                    <time
                      dateTime={item.createdAt}
                      title={formatDateTimeFull(item.createdAt)}
                    >
                      {dateTimeLabel(item.createdAt)}
                    </time>
                  </td>
                  <td>{item.actor?.fullName ?? 'System / unknown'}</td>
                  <td>{readableLabel(item.action)}</td>
                  <td>{readableLabel(item.entityType)}</td>
                  <td className="reference-cell">
                    {item.entityId ?? 'Not available'}
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
            Previous page
          </button>
          <span>
            Showing {(page - 1) * 25 + 1} to {Math.min(page * 25, total)} of{' '}
            {total} events
          </span>
          <button
            disabled={page >= pageCount}
            onClick={() => {
              setPage((current) => current + 1)
              setLoading(true)
            }}
            type="button"
          >
            Next page
          </button>
        </nav>
      )}
    </main>
  )
}
