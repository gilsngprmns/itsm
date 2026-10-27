import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { formatDateTimeFull } from '../common/format'
import { statusLabel } from '../common/StatusBadge'
import { apiRequest } from '../lib/api'
import type { Ticket, TicketComment } from './ticket-types'

export function TicketPrintPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<TicketComment[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void Promise.all([
      apiRequest<Ticket>(`tickets/${id}`),
      apiRequest<TicketComment[]>(`tickets/${id}/comments`),
    ])
      .then(([ticketResult, commentResult]) => {
        if (!active) return
        setTicket(ticketResult)
        setComments(commentResult.filter((comment) => !comment.isInternal))
      })
      .catch(() => {
        if (active) setError('Ticket not found or access denied.')
      })
    return () => {
      active = false
    }
  }, [id])

  if (error)
    return (
      <main className="page">
        <p role="alert">{error}</p>
        <Link to={`/tickets/${id}`}>Back to ticket</Link>
      </main>
    )
  if (!ticket)
    return (
      <main className="page">
        <p role="status">Loading ticket…</p>
      </main>
    )

  return (
    <main className="page ticket-print-sheet">
      <div className="no-print print-actions">
        <Link to={`/tickets/${id}`}>Back to ticket</Link>
        <button onClick={() => window.print()} type="button">
          Print ticket
        </button>
      </div>
      <header>
        <h1>Service ticket {ticket.ticketNumber}</h1>
        <p>
          Printed {formatDateTimeFull(new Date().toISOString())} by{' '}
          {user?.fullName ?? 'Current user'}
        </p>
      </header>
      <h2>{ticket.subject}</h2>
      <dl className="print-ticket-grid">
        <div>
          <dt>Status</dt>
          <dd>{statusLabel(ticket.status)}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>
            {ticket.type === 'SERVICE_REQUEST' ? 'Service request' : 'Incident'}
          </dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>{ticket.priority}</dd>
        </div>
        <div>
          <dt>Requester</dt>
          <dd>{ticket.requester.fullName}</dd>
        </div>
        <div>
          <dt>Assignee</dt>
          <dd>{ticket.assignee?.fullName ?? 'Unassigned'}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDateTimeFull(ticket.createdAt)}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{ticket.category?.name ?? 'None'}</dd>
        </div>
        <div>
          <dt>Related asset</dt>
          <dd>
            {ticket.asset
              ? `${ticket.asset.assetTag} — ${ticket.asset.name}`
              : 'None'}
          </dd>
        </div>
      </dl>
      <section>
        <h2>Description</h2>
        <p className="print-pre-wrap">{ticket.description}</p>
      </section>
      {ticket.resolutionSummary && (
        <section>
          <h2>Resolution</h2>
          <p className="print-pre-wrap">{ticket.resolutionSummary}</p>
        </section>
      )}
      <section>
        <h2>Public conversation</h2>
        {comments.length ? (
          comments.map((comment) => (
            <article className="print-comment" key={comment.id}>
              <strong>{comment.author.fullName}</strong>
              <small>{formatDateTimeFull(comment.createdAt)}</small>
              <p className="print-pre-wrap">{comment.body}</p>
            </article>
          ))
        ) : (
          <p>No public comments.</p>
        )}
      </section>
    </main>
  )
}
