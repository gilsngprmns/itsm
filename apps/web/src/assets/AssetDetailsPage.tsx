import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { formatDate, formatDateTime } from '../common/format'
import { StatusBadge, statusLabel } from '../common/StatusBadge'
import { ApiRequestError, apiRequest, buildApiUrl } from '../lib/api'
import { onTicketChanged } from '../tickets/ticket-events'

interface AssetDetail {
  id: string
  assetCode: string
  isShared: boolean
  assetTag: string
  name: string
  category: { id: string; name: string }
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  description: string | null
  status: string
  condition: string
  purchaseDate: string | null
  purchaseCost: string | null
  warrantyStart: string | null
  warrantyEnd: string | null
  location: { id: string; name: string } | null
  notes: string | null
  assignedUser?: { id: string; fullName: string } | null
}

interface UserList {
  items: Array<{
    id: string
    fullName: string
    email?: string
    isActive: boolean
  }>
}

interface TimelineItem {
  id: string
  action: string
  oldValues: unknown
  newValues: unknown
  actorId: string | null
  createdAt: string
}

interface AssignmentItem {
  id: string
  assignedAt: string
  returnedAt: string | null
  notes: string | null
  assignedUser: { id: string; fullName: string } | null
}

const statusOptions = [
  'AVAILABLE',
  'IN_REPAIR',
  'DAMAGED',
  'LOST',
  'RETIRED',
  'DISPOSED',
]

function failureMessage(error: unknown): string {
  if (!(error instanceof ApiRequestError))
    return 'The API could not complete the request.'
  if (error.status === 401) return 'Your session expired. Sign in again.'
  if (error.status === 403) return 'You do not have permission to do this.'
  if (error.status === 404)
    return 'Asset not found or you do not have access to it.'
  if (error.status === 409)
    return 'The action conflicts with the current asset state.'
  if (error.status === 400) return 'Review the form and try again.'
  return 'The API could not complete the request.'
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return 'Not set'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

export function AssetDetailsPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [asset, setAsset] = useState<AssetDetail | null>(null)
  const [history, setHistory] = useState<TimelineItem[]>([])
  const [assignments, setAssignments] = useState<AssignmentItem[]>([])
  const [users, setUsers] = useState<UserList['items']>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [notes, setNotes] = useState('')
  const [nextStatus, setNextStatus] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const canUpdate = user?.permissions.includes('assets.update') ?? false
  const canAssign = user?.permissions.includes('assets.assign') ?? false
  const canRetire = user?.permissions.includes('assets.retire') ?? false
  const canShare = user?.permissions.includes('assets.share') ?? false
  const canReadTickets =
    user?.permissions.some((permission) =>
      ['tickets.read.all', 'tickets.read.own'].includes(permission),
    ) ?? false
  const [linkedTickets, setLinkedTickets] = useState<
    Array<{ id: string; ticketNumber: string; subject: string; status: string }>
  >([])
  const [linkedTicketPage, setLinkedTicketPage] = useState(1)
  const [linkedTicketSummary, setLinkedTicketSummary] = useState<{
    total: number
    open: number
    lastTicketAt: string | null
  }>({ total: 0, open: 0, lastTicketAt: null })

  const load = useCallback(async () => {
    try {
      const requests = [
        apiRequest<AssetDetail>(`assets/${id}`),
        apiRequest<TimelineItem[]>(`assets/${id}/history`),
        apiRequest<AssignmentItem[]>(`assets/${id}/assignments`),
      ] as const
      const [assetResult, historyResult, assignmentResult] =
        await Promise.all(requests)
      setAsset(assetResult)
      setHistory(historyResult)
      setAssignments(assignmentResult)
      if (canReadTickets) {
        const linked = await apiRequest<{
          items: Array<{
            id: string
            ticketNumber: string
            subject: string
            status: string
          }>
          total: number
          open: number
          lastTicketAt: string | null
        }>(`assets/${id}/tickets?limit=10&page=${linkedTicketPage}`)
        setLinkedTickets(linked.items)
        setLinkedTicketSummary({
          total: linked.total,
          open: linked.open,
          lastTicketAt: linked.lastTicketAt,
        })
      }
      setError(null)
      if (canAssign) {
        const usersResult = await apiRequest<UserList>('users?limit=100')
        setUsers(usersResult.items.filter((record) => record.isActive))
      }
    } catch (cause) {
      setError(failureMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [id, canAssign, canReadTickets, linkedTicketPage])

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
        if (!canReadTickets) return
        setLoading(true)
        void load()
      }),
    [canReadTickets, load],
  )

  const updateAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!asset) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest<AssetDetail>(`assets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: asset.name,
          manufacturer: asset.manufacturer,
          model: asset.model,
          serialNumber: asset.serialNumber,
          description: asset.description,
          purchaseDate: asset.purchaseDate,
          purchaseCost: asset.purchaseCost ? Number(asset.purchaseCost) : null,
          warrantyStart: asset.warrantyStart,
          warrantyEnd: asset.warrantyEnd,
          notes: asset.notes,
          ...(canShare ? { isShared: asset.isShared } : {}),
        }),
      })
      setNotice('Asset details updated.')
      await load()
    } catch (cause) {
      setError(failureMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!nextStatus) return
    if (
      (nextStatus === 'RETIRED' || nextStatus === 'DISPOSED') &&
      !window.confirm(`Confirm changing this asset to ${nextStatus}?`)
    ) {
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest<AssetDetail>(`assets/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, reason }),
      })
      setNotice(`Status changed to ${nextStatus}.`)
      setNextStatus('')
      setReason('')
      await load()
    } catch (cause) {
      setError(failureMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  const assignAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedUser) return
    const replacing = asset?.status === 'ASSIGNED'
    if (
      replacing &&
      !window.confirm(
        'Replace the current assignee? Assignment history is retained.',
      )
    ) {
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest<AssetDetail>(`assets/${id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser, notes }),
      })
      setNotice(replacing ? 'Assignment changed.' : 'Asset assigned.')
      setSelectedUser('')
      setNotes('')
      await load()
    } catch (cause) {
      setError(failureMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  const releaseAsset = async () => {
    if (
      !window.confirm('Release this assignment and make the asset available?')
    ) {
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest<void>(`assets/${id}/assignments/release`, {
        method: 'POST',
      })
      setNotice('Assignment released; asset is now available.')
      await load()
    } catch (cause) {
      setError(failureMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="page management-page">
        <p role="status">Loading asset…</p>
      </main>
    )
  }

  if (error && !asset) {
    return (
      <main className="page management-page">
        <Link to="/assets">Back to assets</Link>
        <p className="error-banner" role="alert">
          {error}
        </p>
      </main>
    )
  }

  if (!asset) return null

  const statusChoices = statusOptions.filter(
    (status) =>
      status !== asset.status &&
      (canRetire || !['RETIRED', 'DISPOSED'].includes(status)),
  )

  return (
    <main className="page management-page">
      <header className="page-header">
        <div>
          <h1>{asset.name}</h1>
          <p className="ticket-meta">
            <span className="asset-reference">{asset.assetCode}</span>
            <span className="asset-reference">{asset.assetTag}</span>
            <StatusBadge value={asset.status} />
          </p>
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

      <section className="detail-panel" aria-label="Asset details">
        <div className="asset-qr">
          <img
            alt={`QR code for ${asset.assetCode}`}
            src={buildApiUrl(`assets/${asset.id}/qr`)}
          />
          <p>Scan to open this asset after signing in.</p>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Category</dt>
            <dd>{asset.category.name}</dd>
          </div>
          <div>
            <dt>Ticket sharing</dt>
            <dd>
              {asset.isShared ? 'Shared' : 'Restricted to assignee and staff'}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <StatusBadge value={asset.status} />
            </dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{asset.location?.name ?? 'No location'}</dd>
          </div>
          <div>
            <dt>Assigned to</dt>
            <dd>{asset.assignedUser?.fullName ?? 'Unassigned'}</dd>
          </div>
          <div>
            <dt>Manufacturer</dt>
            <dd>{asset.manufacturer ?? 'Not provided'}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{asset.model ?? 'Not provided'}</dd>
          </div>
          <div>
            <dt>Serial number</dt>
            <dd>{asset.serialNumber ?? 'Not provided'}</dd>
          </div>
          <div>
            <dt>Purchase date</dt>
            <dd>
              {asset.purchaseDate ? formatDate(asset.purchaseDate) : 'Not set'}
            </dd>
          </div>
          <div>
            <dt>Warranty ends</dt>
            <dd>
              {asset.warrantyEnd ? formatDate(asset.warrantyEnd) : 'Not set'}
            </dd>
          </div>
          <div>
            <dt>Condition</dt>
            <dd>{asset.condition}</dd>
          </div>
          <div className="field-wide">
            <dt>Notes</dt>
            <dd>{asset.notes ?? 'No notes'}</dd>
          </div>
        </dl>
      </section>

      {canUpdate && (
        <form
          className="form-panel"
          onSubmit={(event) => void updateAsset(event)}
        >
          <h2>Edit asset details</h2>
          <div className="form-grid">
            <label>
              Name
              <input
                maxLength={200}
                onChange={(event) =>
                  setAsset({ ...asset, name: event.target.value })
                }
                required
                value={asset.name}
              />
            </label>
            <label>
              Manufacturer
              <input
                maxLength={150}
                onChange={(event) =>
                  setAsset({
                    ...asset,
                    manufacturer: event.target.value || null,
                  })
                }
                value={asset.manufacturer ?? ''}
              />
            </label>
            <label>
              Model
              <input
                maxLength={150}
                onChange={(event) =>
                  setAsset({ ...asset, model: event.target.value || null })
                }
                value={asset.model ?? ''}
              />
            </label>
            <label>
              Serial number
              <input
                maxLength={150}
                onChange={(event) =>
                  setAsset({
                    ...asset,
                    serialNumber: event.target.value || null,
                  })
                }
                value={asset.serialNumber ?? ''}
              />
            </label>
            <label>
              Purchase date
              <input
                onChange={(event) =>
                  setAsset({
                    ...asset,
                    purchaseDate: event.target.value || null,
                  })
                }
                type="date"
                value={asset.purchaseDate ?? ''}
              />
            </label>
            <label>
              Warranty end
              <input
                onChange={(event) =>
                  setAsset({
                    ...asset,
                    warrantyEnd: event.target.value || null,
                  })
                }
                type="date"
                value={asset.warrantyEnd ?? ''}
              />
            </label>
            <label className="field-wide">
              Notes
              <textarea
                maxLength={2000}
                onChange={(event) =>
                  setAsset({ ...asset, notes: event.target.value || null })
                }
                value={asset.notes ?? ''}
              />
            </label>
          </div>
          {canShare && (
            <label className="checkbox-field">
              <input
                checked={asset.isShared}
                onChange={(event) =>
                  setAsset({ ...asset, isShared: event.target.checked })
                }
                type="checkbox"
              />{' '}
              Allow users to link this asset to their tickets
            </label>
          )}
          <button disabled={saving} type="submit">
            {saving ? 'Saving…' : 'Save asset'}
          </button>
        </form>
      )}

      {canUpdate && asset.status !== 'ASSIGNED' && statusChoices.length > 0 && (
        <form
          className="form-panel"
          onSubmit={(event) => void changeStatus(event)}
        >
          <h2>Change status</h2>
          <div className="form-grid">
            <label>
              New status
              <select
                onChange={(event) => setNextStatus(event.target.value)}
                required
                value={nextStatus}
              >
                <option value="">Select status</option>
                {statusChoices.map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Reason
              <input
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
                value={reason}
              />
            </label>
          </div>
          <button disabled={saving || !nextStatus} type="submit">
            Update status
          </button>
        </form>
      )}

      {canAssign && !['RETIRED', 'DISPOSED'].includes(asset.status) && (
        <section className="form-panel">
          <h2>
            {asset.status === 'ASSIGNED' ? 'Reassign asset' : 'Assign asset'}
          </h2>
          {asset.assignedUser && (
            <p>Current assignee: {asset.assignedUser.fullName}</p>
          )}
          <form onSubmit={(event) => void assignAsset(event)}>
            <div className="form-grid">
              <label>
                Active user
                <select
                  onChange={(event) => setSelectedUser(event.target.value)}
                  required
                  value={selectedUser}
                >
                  <option value="">Select user</option>
                  {users
                    .filter((record) => record.id !== asset.assignedUser?.id)
                    .map((record) => (
                      <option key={record.id} value={record.id}>
                        {record.fullName}
                        {record.email ? ` (${record.email})` : ''}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Assignment notes
                <input
                  maxLength={1000}
                  onChange={(event) => setNotes(event.target.value)}
                  value={notes}
                />
              </label>
            </div>
            <button disabled={saving || !selectedUser} type="submit">
              {asset.status === 'ASSIGNED' ? 'Reassign' : 'Assign'}
            </button>
          </form>
          {asset.status === 'ASSIGNED' && (
            <button
              disabled={saving}
              type="button"
              onClick={() => void releaseAsset()}
            >
              Release assignment
            </button>
          )}
        </section>
      )}

      {assignments.length > 0 && (
        <section className="detail-panel">
          <h2>Assignment history</h2>
          <ul className="timeline">
            {assignments.map((assignment) => (
              <li key={assignment.id}>
                <strong>
                  {assignment.assignedUser?.fullName ?? 'Assigned user'}
                </strong>
                <span>
                  {formatDateTime(assignment.assignedAt)}
                  {assignment.returnedAt
                    ? ` Returned ${formatDateTime(assignment.returnedAt)}.`
                    : ' Current assignment.'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canReadTickets && (
        <section className="detail-panel">
          <h2>Related tickets</h2>
          <p>
            {linkedTicketSummary.total} total · {linkedTicketSummary.open} open
            · Last ticket{' '}
            {linkedTicketSummary.lastTicketAt
              ? formatDateTime(linkedTicketSummary.lastTicketAt)
              : 'none'}
          </p>
          {linkedTickets.length ? (
            <ul>
              {linkedTickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link to={`/tickets/${ticket.id}`}>
                    {ticket.ticketNumber} — {ticket.subject}
                  </Link>{' '}
                  ({statusLabel(ticket.status)})
                </li>
              ))}
            </ul>
          ) : (
            <p>No tickets have been linked to this asset.</p>
          )}
          {linkedTicketSummary.total > 10 && (
            <nav aria-label="Related ticket pages" className="pagination">
              <button
                disabled={linkedTicketPage <= 1}
                onClick={() => setLinkedTicketPage((page) => page - 1)}
                type="button"
              >
                Previous
              </button>
              <span>
                Page {linkedTicketPage} of{' '}
                {Math.ceil(linkedTicketSummary.total / 10)}
              </span>
              <button
                disabled={linkedTicketPage * 10 >= linkedTicketSummary.total}
                onClick={() => setLinkedTicketPage((page) => page + 1)}
                type="button"
              >
                Next
              </button>
            </nav>
          )}
        </section>
      )}

      <section className="detail-panel">
        <h2>Asset history</h2>
        {history.length === 0 ? (
          <p className="empty-state">No history has been recorded.</p>
        ) : (
          <ol className="timeline">
            {history.map((entry) => (
              <li key={`${entry.id}-${entry.action}`}>
                <strong>{entry.action.replaceAll('.', ' ')}</strong>
                <span>{formatDateTime(entry.createdAt)}</span>
                <small>Before: {displayValue(entry.oldValues)}</small>
                <small>After: {displayValue(entry.newValues)}</small>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  )
}
