import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import type { Request } from 'express'
import { DataSource } from 'typeorm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedUser } from '../src/modules/auth/auth.types'
import type { CreateTicketDto } from '../src/modules/tickets/dto/create-ticket.dto'
import { canTransitionTicket } from '../src/modules/tickets/ticket-status'
import { TicketsService } from '../src/modules/tickets/tickets.service'

const owner: AuthenticatedUser = {
  id: 'requester-id',
  fullName: 'Requester',
  email: 'requester@example.test',
  roles: ['USER'],
  permissions: ['tickets.create', 'tickets.read.own', 'tickets.comment'],
}

const ticketRow = {
  id: 'ticket-id',
  ticket_number: '42',
  ticket_year: '2026',
  subject: 'Cannot connect',
  description: 'Network unavailable',
  requester_id: owner.id,
  requester_name: owner.fullName,
  assigned_to: null,
  assignee_name: null,
  category_id: 'category-id',
  category_code: 'NETWORK',
  category_name: 'Network',
  asset_id: null,
  asset_tag: null,
  asset_name: null,
  location_id: null,
  location_code: null,
  location_name: null,
  priority: 'MEDIUM' as const,
  status: 'OPEN' as const,
  type: 'INCIDENT' as const,
  resolution_summary: null,
  resolved_at: null,
  closed_at: null,
  created_at: new Date('2026-10-19T00:00:00Z'),
  updated_at: new Date('2026-10-19T00:00:00Z'),
}

const request = {
  ip: '127.0.0.1',
  headers: { 'user-agent': 'ticket-test' },
} as Request

describe('ticket lifecycle', () => {
  it('allows only documented lifecycle transitions', () => {
    expect(canTransitionTicket('OPEN', 'IN_PROGRESS')).toBe(true)
    expect(canTransitionTicket('OPEN', 'RESOLVED')).toBe(false)
    expect(canTransitionTicket('RESOLVED', 'IN_PROGRESS')).toBe(true)
    expect(canTransitionTicket('OPEN', 'CLOSED')).toBe(false)
    expect(canTransitionTicket('CLOSED', 'IN_PROGRESS')).toBe(false)
    expect(canTransitionTicket('CANCELLED', 'OPEN')).toBe(false)
  })
})

describe('TicketsService', () => {
  let dataSource: DataSource
  let query: ReturnType<typeof vi.spyOn>
  let rawQuery: ReturnType<typeof vi.spyOn>
  let service: TicketsService

  beforeEach(() => {
    dataSource = new DataSource({
      type: 'postgres',
      url: 'postgres://localhost/it_db',
    })
    query = vi.spyOn(dataSource.manager, 'query')
    rawQuery = vi.spyOn(dataSource, 'query')
    vi.spyOn(dataSource, 'transaction').mockImplementation((async (
      ...args: unknown[]
    ) => {
      const runInTransaction = args[args.length - 1]
      if (typeof runInTransaction !== 'function') {
        throw new Error('Expected a TypeORM transaction callback')
      }
      return runInTransaction(dataSource.manager)
    }) as typeof dataSource.transaction)
    service = new TicketsService(dataSource)
  })

  it('creates tickets with backend-owned requester and database-generated number', async () => {
    query
      .mockResolvedValueOnce([{ id: 'category-id' }])
      .mockResolvedValueOnce([{ id: ticketRow.id }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([ticketRow])
    const dto: CreateTicketDto = {
      subject: ' Cannot connect ',
      description: ' Network unavailable ',
      categoryId: 'category-id',
      type: 'INCIDENT',
    }

    const result = await service.create(dto, owner, request)

    expect(result.ticketNumber).toBe('TCK-2026-000042')
    expect(result.requester.id).toBe(owner.id)
    expect(query.mock.calls[1][0]).toContain('INSERT INTO public.tickets')
    expect(query.mock.calls[1][0]).not.toContain('ticket_number')
    expect(query.mock.calls[1][1]).toEqual([
      'Cannot connect',
      'Network unavailable',
      owner.id,
      'category-id',
      null,
      null,
      'MEDIUM',
      'INCIDENT',
    ])
    expect(query.mock.calls[2][0]).toContain('ticket_status_history')
    expect(query.mock.calls[3][0]).toContain('audit_logs')
  })

  it('paginates only assets linkable by an ordinary requester', async () => {
    rawQuery.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([
      {
        id: 'asset-id',
        asset_code: 'AST-1',
        asset_tag: 'LAP-1',
        name: 'Laptop',
      },
    ])

    const result = await service.linkableAssets(
      { search: 'Laptop', page: 2, limit: 10 },
      owner,
    )

    expect(result).toMatchObject({ page: 2, limit: 10, total: 1 })
    expect(result.items[0]).toEqual({
      id: 'asset-id',
      assetCode: 'AST-1',
      assetTag: 'LAP-1',
      name: 'Laptop',
    })
    expect(rawQuery.mock.calls[0][0]).toContain('a.is_shared = true')
    expect(rawQuery.mock.calls[0][0]).toContain('aa.user_id = $2')
  })

  it('hides another requester ticket as not found', async () => {
    query.mockResolvedValueOnce([{ ...ticketRow, requester_id: 'other-user' }])

    await expect(service.get(ticketRow.id, owner)).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('scopes USER list queries to the authenticated requester', async () => {
    rawQuery.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([])

    const result = await service.list(
      {
        page: 1,
        limit: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
      owner,
    )

    expect(result.items).toEqual([])
    expect(rawQuery.mock.calls[0][0]).toContain('t.requester_id = $1')
    expect(rawQuery.mock.calls[0][1]).toEqual([owner.id])
    expect(rawQuery.mock.calls[1][1]).toEqual([owner.id, 25, 0])
  })

  it('rejects requester filters from users without all-ticket permission', async () => {
    await expect(
      service.list(
        {
          page: 1,
          limit: 25,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          requesterId: 'another-user',
        },
        owner,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(rawQuery).not.toHaveBeenCalled()
  })

  it('prevents IT support from changing unassigned ticket fields', async () => {
    const support: AuthenticatedUser = {
      ...owner,
      permissions: [
        'tickets.read.all',
        'tickets.update.assigned',
        'tickets.self_assign',
      ],
    }
    await expect(
      service.update(
        ticketRow.id,
        { subject: 'Changed by support' },
        support,
        request,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(query).not.toHaveBeenCalled()
  })

  it('uses a conditional update for race-safe self-assignment', async () => {
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: ticketRow.id }])
    const support: AuthenticatedUser = {
      ...owner,
      permissions: ['tickets.read.all', 'tickets.self_assign'],
    }

    await expect(
      service.selfAssign(ticketRow.id, support, request),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(query.mock.calls[0][0]).toContain('assigned_to IS NULL')
    expect(query.mock.calls[0][0]).toContain('status NOT IN')
  })

  it('requires a resolution summary before marking a ticket resolved', async () => {
    query.mockResolvedValueOnce([
      { ...ticketRow, status: 'IN_PROGRESS' as const },
    ])

    await expect(
      service.setStatus(
        ticketRow.id,
        { status: 'RESOLVED' },
        {
          ...owner,
          roles: ['ADMIN'],
          permissions: ['tickets.read.all', 'tickets.update'],
        },
        request,
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('updates ticket status with consistently typed SQL parameters', async () => {
    const updatedTicket = { ...ticketRow, status: 'PENDING' as const }
    query
      .mockResolvedValueOnce([{ ...ticketRow, status: 'IN_PROGRESS' as const }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([updatedTicket])

    const result = await service.setStatus(
      ticketRow.id,
      { status: 'PENDING' },
      {
        ...owner,
        roles: ['ADMIN'],
        permissions: ['tickets.read.all', 'tickets.update'],
      },
      request,
    )

    expect(result.status).toBe('PENDING')
    expect(query.mock.calls[1][0]).toContain('SET status = $2::text')
    expect(query.mock.calls[1][0]).toContain("$2::text = 'RESOLVED'")
    expect(query.mock.calls[1][0]).toContain("$1::text = 'RESOLVED'")
    expect(query.mock.calls[1][1]).toEqual([
      'IN_PROGRESS',
      'PENDING',
      null,
      ticketRow.id,
    ])
  })

  it('rejects an invalid status transition without writing history', async () => {
    query.mockResolvedValueOnce([ticketRow])

    await expect(
      service.setStatus(
        ticketRow.id,
        { status: 'CLOSED' },
        {
          ...owner,
          roles: ['ADMIN'],
          permissions: ['tickets.read.all', 'tickets.update'],
        },
        request,
      ),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('keeps internal comments hidden for requesters', async () => {
    query.mockResolvedValueOnce([ticketRow])
    rawQuery.mockResolvedValueOnce([
      {
        id: 'comment-id',
        body: 'Public reply',
        is_internal: false,
        author_id: owner.id,
        author_name: owner.fullName,
        created_at: ticketRow.created_at,
      },
    ])

    const result = await service.comments(ticketRow.id, owner)

    expect(rawQuery.mock.calls[0][0]).toContain('c.is_internal = false')
    expect(rawQuery.mock.calls[0][1]).toEqual([ticketRow.id, false])
    expect(result).toHaveLength(1)
    expect(result[0].isInternal).toBe(false)
  })
})
