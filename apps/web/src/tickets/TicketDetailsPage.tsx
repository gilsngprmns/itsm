import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { apiRequest } from '../lib/api'
import { ticketErrorMessage } from './ticket-errors'
import {
  STATUS_TRANSITIONS,
  type Ticket,
  type TicketComment,
  type TicketCategory,
  type TicketHistory,
  type TicketStatus,
} from './ticket-types'

interface Assignee {
  id: string
  fullName: string
}

export function TicketDetailsPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const canUpdate = user?.permissions.includes('tickets.update') ?? false
  const canAssign = user?.permissions.includes('tickets.assign') ?? false
  const canComment = user?.permissions.includes('tickets.comment') ?? false
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [categories, setCategories] = useState<TicketCategory[]>([])
  const [comments, setComments] = useState<TicketComment[]>([])
  const [history, setHistory] = useState<TicketHistory | null>(null)
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [nextStatus, setNextStatus] = useState<TicketStatus | ''>('')
  const [resolutionSummary, setResolutionSummary] = useState('')
  const [statusReason, setStatusReason] = useState('')
  const [assignmentReason, setAssignmentReason] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editPriority, setEditPriority] = useState<Ticket['priority']>('MEDIUM')
  const [isInternal, setIsInternal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadTicket = useCallback(async () => {
    if (!id) return
    try {
      const [ticketResult, commentResult, historyResult] = await Promise.all([
        apiRequest<Ticket>(`tickets/${id}`),
        apiRequest<TicketComment[]>(`tickets/${id}/comments`),
        apiRequest<TicketHistory>(`tickets/${id}/history`),
      ])
      setTicket(ticketResult)
      setEditSubject(ticketResult.subject)
      setEditDescription(ticketResult.description)
      setEditCategoryId(ticketResult.category?.id ?? '')
      setEditPriority(ticketResult.priority)
      setComments(commentResult)
      setHistory(historyResult)
      setAssigneeId(ticketResult.assignee?.id ?? '')
      if (canUpdate) {
        setCategories(await apiRequest<TicketCategory[]>('ticket-categories'))
      }
      setError(null)
    } catch (cause) {
      setError(ticketErrorMessage(cause, 'load ticket details'))
    } finally {
      setLoading(false)
    }
  }, [id, canUpdate])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void loadTicket()
    })
    return () => {
      active = false
    }
  }, [loadTicket])

  useEffect(() => {
    if (!canAssign) return
    let active = true
    queueMicrotask(() => {
      void apiRequest<Assignee[]>('tickets/assignees')
        .then((result) => {
          if (active) setAssignees(result)
        })
        .catch((cause: unknown) => {
          if (active)
            setError(ticketErrorMessage(cause, 'load ticket assignees'))
        })
    })
    return () => {
      active = false
    }
  }, [canAssign])

  const changeStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!id || !nextStatus || !ticket) return
    if (
      nextStatus === 'CANCELLED' &&
      !window.confirm('Cancel this ticket? This action cannot be undone.')
    ) {
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest<Ticket>(`tickets/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          ...(statusReason.trim() ? { reason: statusReason.trim() } : {}),
          ...(nextStatus === 'RESOLVED'
            ? { resolutionSummary: resolutionSummary.trim() }
            : {}),
        }),
      })
      setNextStatus('')
      setResolutionSummary('')
      setStatusReason('')
      setNotice(`Ticket updated to ${nextStatus.replace('_', ' ')}.`)
      setLoading(true)
      await loadTicket()
    } catch (cause) {
      setError(ticketErrorMessage(cause, 'update ticket status'))
    } finally {
      setSaving(false)
    }
  }

  const changeAssignee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!id) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest<Ticket>(`tickets/${id}/assignment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigneeId: assigneeId || null,
          ...(assignmentReason.trim()
            ? { reason: assignmentReason.trim() }
            : {}),
        }),
      })
      setNotice('Ticket assignment updated.')
      setLoading(true)
      await loadTicket()
    } catch (cause) {
      setError(ticketErrorMessage(cause, 'update ticket assignment'))
    } finally {
      setSaving(false)
    }
  }

  const updateTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!id) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest<Ticket>(`tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: editSubject,
          description: editDescription,
          ...(editCategoryId ? { categoryId: editCategoryId } : {}),
          priority: editPriority,
        }),
      })
      setNotice('Ticket details updated.')
      setLoading(true)
      await loadTicket()
    } catch (cause) {
      setError(ticketErrorMessage(cause, 'update ticket details'))
    } finally {
      setSaving(false)
    }
  }

  const addComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!id) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest<void>(`tickets/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: commentBody,
          ...(canUpdate ? { isInternal } : {}),
        }),
      })
      setCommentBody('')
      setIsInternal(false)
      setNotice(isInternal ? 'Internal note added.' : 'Comment added.')
      setLoading(true)
      await loadTicket()
    } catch (cause) {
      setError(ticketErrorMessage(cause, 'add comment'))
    } finally {
      setSaving(false)
    }
  }

  if (loading && !ticket) {
    return (
      <main className="page management-page">
        <p role="status">Loading ticket…</p>
      </main>
    )
  }
  if (!ticket) {
    return (
      <main className="page management-page">
        <p className="error-banner" role="alert">
          {error ?? 'Ticket not found.'}
        </p>
        <Link to="/tickets">Return to tickets</Link>
      </main>
    )
  }

  const transitions = STATUS_TRANSITIONS[ticket.status]

  return (
    <main className="page management-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{ticket.ticketNumber}</p>
          <h1>{ticket.subject}</h1>
          <p className="intro">
            <span className="status-pill">
              {ticket.status.replace('_', ' ')}
            </span>{' '}
            {ticket.priority}
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

      <section
        className="detail-panel"
        aria-labelledby="ticket-details-heading"
      >
        <h2 id="ticket-details-heading">Ticket details</h2>
        <dl className="detail-grid">
          <div>
            <dt>Requester</dt>
            <dd>{ticket.requester.fullName}</dd>
          </div>
          <div>
            <dt>Assignee</dt>
            <dd>{ticket.assignee?.fullName ?? 'Unassigned'}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{ticket.category?.name ?? '—'}</dd>
          </div>
          <div>
            <dt>Related asset</dt>
            <dd>
              {ticket.asset
                ? `${ticket.asset.assetTag} — ${ticket.asset.name}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{ticket.location?.name ?? '—'}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{new Date(ticket.createdAt).toLocaleString()}</dd>
          </div>
          <div className="field-wide">
            <dt>Description</dt>
            <dd className="ticket-description">{ticket.description}</dd>
          </div>
          {ticket.resolutionSummary && (
            <div className="field-wide">
              <dt>Resolution</dt>
              <dd>{ticket.resolutionSummary}</dd>
            </div>
          )}
        </dl>
      </section>

      {canUpdate &&
        ticket.status !== 'CLOSED' &&
        ticket.status !== 'CANCELLED' && (
          <section className="form-panel" aria-labelledby="edit-ticket-heading">
            <h2 id="edit-ticket-heading">Edit ticket</h2>
            <form className="form-grid" onSubmit={updateTicket}>
              <label className="field-wide">
                Subject
                <input
                  required
                  maxLength={200}
                  value={editSubject}
                  onChange={(event) => setEditSubject(event.target.value)}
                />
              </label>
              <label>
                Category
                <select
                  required
                  value={editCategoryId}
                  onChange={(event) => setEditCategoryId(event.target.value)}
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
                  value={editPriority}
                  onChange={(event) =>
                    setEditPriority(event.target.value as Ticket['priority'])
                  }
                >
                  {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map(
                    (priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="field-wide">
                Description
                <textarea
                  required
                  maxLength={10_000}
                  rows={4}
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                />
              </label>
              <div>
                <button disabled={saving} type="submit">
                  Save changes
                </button>
              </div>
            </form>
          </section>
        )}

      {canUpdate && transitions.length > 0 && (
        <section className="form-panel" aria-labelledby="status-heading">
          <h2 id="status-heading">Update status</h2>
          <form className="form-grid" onSubmit={changeStatus}>
            <label>
              New status
              <select
                required
                value={nextStatus}
                onChange={(event) =>
                  setNextStatus(event.target.value as TicketStatus)
                }
              >
                <option value="">Select status</option>
                {transitions.map((value) => (
                  <option key={value} value={value}>
                    {value.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            {nextStatus === 'RESOLVED' && (
              <label className="field-wide">
                Resolution summary
                <textarea
                  required
                  maxLength={4000}
                  value={resolutionSummary}
                  onChange={(event) => setResolutionSummary(event.target.value)}
                />
              </label>
            )}
            <label className="field-wide">
              Reason (optional)
              <input
                maxLength={1000}
                value={statusReason}
                onChange={(event) => setStatusReason(event.target.value)}
              />
            </label>
            <div>
              <button disabled={saving || !nextStatus} type="submit">
                Update status
              </button>
            </div>
          </form>
        </section>
      )}

      {canAssign &&
        ticket.status !== 'CLOSED' &&
        ticket.status !== 'CANCELLED' && (
          <section className="form-panel" aria-labelledby="assignment-heading">
            <h2 id="assignment-heading">Assignment</h2>
            <form className="form-grid" onSubmit={changeAssignee}>
              <label>
                Assigned support user
                <select
                  value={assigneeId}
                  onChange={(event) => setAssigneeId(event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {assignees.map((assignee) => (
                    <option key={assignee.id} value={assignee.id}>
                      {assignee.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Assignment reason (optional)
                <input
                  maxLength={1000}
                  value={assignmentReason}
                  onChange={(event) => setAssignmentReason(event.target.value)}
                />
              </label>
              <div>
                <button
                  disabled={
                    saving || assigneeId === (ticket.assignee?.id ?? '')
                  }
                  type="submit"
                >
                  Save assignment
                </button>
              </div>
            </form>
            {assignees.length === 0 && (
              <p className="form-help">
                No active user currently has ticket-update permission.
              </p>
            )}
          </section>
        )}

      <section className="detail-panel" aria-labelledby="comments-heading">
        <h2 id="comments-heading">Conversation</h2>
        {comments.length === 0 ? (
          <p className="empty-state">No comments yet.</p>
        ) : (
          <ol className="timeline">
            {comments.map((comment) => (
              <li key={comment.id}>
                <strong>
                  {comment.author.fullName}
                  {comment.isInternal ? ' — Internal note' : ''}
                </strong>
                <span>{comment.body}</span>
                <small>{new Date(comment.createdAt).toLocaleString()}</small>
              </li>
            ))}
          </ol>
        )}
        {canComment &&
          ticket.status !== 'CLOSED' &&
          ticket.status !== 'CANCELLED' && (
            <form className="form-grid" onSubmit={addComment}>
              <label className="field-wide">
                Add comment
                <textarea
                  required
                  maxLength={5000}
                  rows={4}
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                />
              </label>
              {canUpdate && (
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(event) => setIsInternal(event.target.checked)}
                  />
                  Internal note (hidden from requesters and auditors)
                </label>
              )}
              <div>
                <button disabled={saving || !commentBody.trim()} type="submit">
                  Add comment
                </button>
              </div>
            </form>
          )}
      </section>

      <section className="detail-panel" aria-labelledby="history-heading">
        <h2 id="history-heading">History</h2>
        {!history ||
        (history.statuses.length === 0 && history.assignments.length === 0) ? (
          <p className="empty-state">No history available.</p>
        ) : (
          <ol className="timeline">
            {history.statuses.map((item, index) => (
              <li key={`status-${index}`}>
                <strong>
                  {item.previousStatus
                    ? `${item.previousStatus.replace('_', ' ')} → ${item.newStatus.replace('_', ' ')}`
                    : `Created as ${item.newStatus}`}
                </strong>
                <span>
                  {item.changedByName ?? 'Former user'}
                  {item.reason ? ` — ${item.reason}` : ''}
                </span>
                <small>{new Date(item.changedAt).toLocaleString()}</small>
              </li>
            ))}
            {history.assignments.map((item, index) => (
              <li key={`assignment-${index}`}>
                <strong>
                  {item.unassignedAt
                    ? `Unassigned ${item.assigneeName}`
                    : `Assigned to ${item.assigneeName}`}
                </strong>
                <span>
                  {item.assignedByName ?? 'Former user'}
                  {item.reason ? ` — ${item.reason}` : ''}
                </span>
                <small>{new Date(item.assignedAt).toLocaleString()}</small>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  )
}
