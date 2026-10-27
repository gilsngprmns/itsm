import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { Request } from 'express'
import { DataSource, type EntityManager } from 'typeorm'
import { getPostgresErrorCode, writeAuditLog } from '../../common/audit-log'
import type { AuthenticatedUser } from '../auth/auth.types'
import type { AssignTicketDto } from './dto/assign-ticket.dto'
import type { CreateCommentDto } from './dto/create-comment.dto'
import type { CreateTicketDto } from './dto/create-ticket.dto'
import type { ListTicketsDto } from './dto/list-tickets.dto'
import type {
  CreateTicketCategoryDto,
  TicketCategoryStatusDto,
  UpdateTicketCategoryDto,
} from './dto/ticket-category.dto'
import type { TicketStatusDto } from './dto/ticket-status.dto'
import type { UpdateTicketDto } from './dto/update-ticket.dto'
import {
  canTransitionTicket,
  type TicketPriority,
  type TicketStatus,
} from './ticket-status'

interface TicketRow {
  id: string
  ticket_number: string
  ticket_year: string
  subject: string
  description: string
  requester_id: string
  requester_name: string
  assigned_to: string | null
  assignee_name: string | null
  category_id: string | null
  category_code: string | null
  category_name: string | null
  asset_id: string | null
  asset_tag: string | null
  asset_name: string | null
  location_id: string | null
  location_code: string | null
  location_name: string | null
  priority: TicketPriority
  status: TicketStatus
  type: 'INCIDENT' | 'SERVICE_REQUEST'
  resolution_summary: string | null
  resolved_at: Date | null
  closed_at: Date | null
  created_at: Date
  updated_at: Date
}

interface TicketCategoryRow {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
  created_at: Date
}

const TICKET_SELECT = `SELECT t.id, t.ticket_number::text AS ticket_number,
       to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY') AS ticket_year,
       t.subject, t.description, t.requester_id,
       requester.full_name AS requester_name,
       t.assigned_to, assignee.full_name AS assignee_name,
       t.category_id, tc.code AS category_code, tc.name AS category_name,
       t.asset_id, a.asset_tag, a.name AS asset_name,
       t.location_id, l.code AS location_code, l.name AS location_name,
       t.priority, t.status, t.type, t.resolution_summary, t.resolved_at,
       t.closed_at, t.created_at, t.updated_at
FROM public.tickets t
JOIN public.users requester ON requester.id = t.requester_id
LEFT JOIN public.users assignee ON assignee.id = t.assigned_to
LEFT JOIN public.ticket_categories tc ON tc.id = t.category_id
LEFT JOIN public.assets a ON a.id = t.asset_id
LEFT JOIN public.locations l ON l.id = t.location_id`

export interface TicketResponse {
  id: string
  ticketNumber: string
  subject: string
  description: string
  requester: { id: string; fullName: string }
  assignee: { id: string; fullName: string } | null
  category: { id: string; code: string; name: string } | null
  asset: { id: string; assetTag: string; name: string } | null
  location: { id: string; code: string; name: string } | null
  priority: TicketPriority
  status: TicketStatus
  type: 'INCIDENT' | 'SERVICE_REQUEST'
  resolutionSummary: string | null
  resolvedAt: Date | null
  closedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface TicketCategoryResponse {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: Date
}

@Injectable()
export class TicketsService {
  constructor(private readonly dataSource: DataSource) {}

  async list(
    query: ListTicketsDto,
    user: AuthenticatedUser,
  ): Promise<{
    items: TicketResponse[]
    page: number
    limit: number
    total: number
  }> {
    const canReadAll = user.permissions.includes('tickets.read.all')
    if (!canReadAll && !user.permissions.includes('tickets.read.own')) {
      throw new ForbiddenException('Insufficient permissions')
    }
    if (query.requesterId && !canReadAll) {
      throw new ForbiddenException('Requester filter is restricted')
    }

    const values: unknown[] = []
    const where = ['t.deleted_at IS NULL']
    const add = (condition: string, value: unknown) => {
      values.push(value)
      where.push(condition.replace('?', `$${values.length}`))
    }
    if (!canReadAll) add('t.requester_id = ?', user.id)
    if (query.status) add('t.status = ?', query.status)
    if (query.priority) add('t.priority = ?', query.priority)
    if (query.type) add('t.type = ?', query.type)
    if (query.assignedToMe === 'true') add('t.assigned_to = ?', user.id)
    if (query.unassigned === 'true') where.push('t.assigned_to IS NULL')
    if (query.categoryId) add('t.category_id = ?', query.categoryId)
    if (query.assigneeId) add('t.assigned_to = ?', query.assigneeId)
    if (query.requesterId) add('t.requester_id = ?', query.requesterId)
    if (query.assetId) add('t.asset_id = ?', query.assetId)
    if (query.search) {
      values.push(`%${escapeLike(query.search.trim())}%`)
      where.push(
        `(t.subject ILIKE $${values.length} ESCAPE '\\' OR
          t.ticket_number::text ILIKE $${values.length} ESCAPE '\\')`,
      )
    }

    const whereSql = where.join(' AND ')
    const totalRows = (await this.dataSource.query(
      `SELECT count(*)::int AS total FROM public.tickets t WHERE ${whereSql}`,
      values,
    )) as Array<{ total: number }>
    const sortColumns = {
      ticketNumber: 't.ticket_number',
      subject: 't.subject',
      status: 't.status',
      priority: 't.priority',
      createdAt: 't.created_at',
    } as const
    const limitParam = values.length + 1
    const offsetParam = values.length + 2
    const rows = (await this.dataSource.query(
      `${TICKET_SELECT}
       WHERE ${whereSql}
       ORDER BY ${sortColumns[query.sortBy]} ${query.sortOrder.toUpperCase()}, t.id
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...values, query.limit, (query.page - 1) * query.limit],
    )) as TicketRow[]

    return {
      items: rows.map(toTicketResponse),
      page: query.page,
      limit: query.limit,
      total: Number(totalRows[0]?.total ?? 0),
    }
  }

  async get(id: string, user: AuthenticatedUser): Promise<TicketResponse> {
    const row = await this.getTicket(this.dataSource.manager, id)
    assertCanReadTicket(row, user)
    return toTicketResponse(row)
  }

  async linkableAssets(
    query: { search?: string; page?: number; limit?: number },
    user: AuthenticatedUser,
  ): Promise<{
    items: Array<{
      id: string
      assetCode: string
      assetTag: string
      name: string
    }>
    page: number
    limit: number
    total: number
  }> {
    const page = query.page ?? 1
    const limit = query.limit ?? 25
    const values: unknown[] = [
      user.permissions.includes('tickets.read.all'),
      user.id,
    ]
    const where = `a.deleted_at IS NULL AND a.status NOT IN ('RETIRED', 'DISPOSED')
      AND ($1::boolean OR a.is_shared = true OR EXISTS (
        SELECT 1 FROM public.asset_assignments aa WHERE aa.asset_id = a.id
          AND aa.user_id = $2 AND aa.returned_at IS NULL))`
    let searchSql = ''
    if (query.search?.trim()) {
      values.push(`%${escapeLike(query.search.trim())}%`)
      searchSql = ` AND (a.asset_code ILIKE $${values.length} ESCAPE '\\'
        OR a.asset_tag ILIKE $${values.length} ESCAPE '\\'
        OR a.name ILIKE $${values.length} ESCAPE '\\')`
    }
    const count = (await this.dataSource.query(
      `SELECT count(*)::int AS total FROM public.assets a WHERE ${where}${searchSql}`,
      values,
    )) as Array<{ total: number }>
    const rows = (await this.dataSource.query(
      `SELECT a.id, a.asset_code, a.asset_tag, a.name FROM public.assets a
       WHERE ${where}${searchSql} ORDER BY a.asset_code, a.id
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, (page - 1) * limit],
    )) as Array<{
      id: string
      asset_code: string
      asset_tag: string
      name: string
    }>
    return {
      items: rows.map((row) => ({
        id: row.id,
        assetCode: row.asset_code,
        assetTag: row.asset_tag,
        name: row.name,
      })),
      page,
      limit,
      total: Number(count[0]?.total ?? 0),
    }
  }

  async create(
    dto: CreateTicketDto,
    user: AuthenticatedUser,
    request: Request,
  ): Promise<TicketResponse> {
    const subject = dto.subject.trim()
    const description = dto.description.trim()
    if (!subject || !description) {
      throw new BadRequestException('Subject and description are required')
    }

    const id = await this.dataSource.transaction(async (manager) => {
      await this.assertActiveCategory(manager, dto.categoryId)
      await this.assertTicketAsset(manager, dto.assetId, user)
      await this.assertActiveLocation(manager, dto.locationId)
      const rows = (await manager.query(
        `INSERT INTO public.tickets
           (subject, description, requester_id, category_id, asset_id,
            location_id, priority, type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          subject,
          description,
          user.id,
          dto.categoryId,
          dto.assetId ?? null,
          dto.locationId ?? null,
          dto.priority ?? 'MEDIUM',
          dto.type,
        ],
      )) as Array<{ id: string }>
      const ticketId = rows[0].id
      await manager.query(
        `INSERT INTO public.ticket_status_history
           (ticket_id, previous_status, new_status, changed_by, reason)
         VALUES ($1, NULL, 'OPEN', $2, 'Ticket created')`,
        [ticketId, user.id],
      )
      await writeAuditLog(
        manager,
        request,
        user.id,
        'tickets.created',
        'ticket',
        ticketId,
        null,
        { subject, priority: dto.priority ?? 'MEDIUM' },
      )
      return ticketId
    })
    return this.get(id, user)
  }

  async update(
    id: string,
    dto: UpdateTicketDto,
    user: AuthenticatedUser,
    request: Request,
  ): Promise<TicketResponse> {
    if (
      user.permissions.includes('tickets.update.assigned') &&
      !user.permissions.includes('tickets.update') &&
      (dto.subject !== undefined ||
        dto.description !== undefined ||
        dto.categoryId !== undefined ||
        dto.priority !== undefined ||
        dto.assetId !== undefined ||
        dto.locationId !== undefined)
    ) {
      throw new ForbiddenException(
        'IT support can only change ticket type outside assigned workflow updates',
      )
    }
    const result = await this.dataSource.transaction(async (manager) => {
      const old = await this.getTicket(manager, id, true)
      assertCanModifyAssignedTicket(old, user)
      assertEditableStatus(old.status)
      const next = {
        subject: dto.subject === undefined ? old.subject : dto.subject.trim(),
        description:
          dto.description === undefined
            ? old.description
            : dto.description.trim(),
        categoryId:
          dto.categoryId === undefined ? old.category_id : dto.categoryId,
        priority: dto.priority ?? old.priority,
        type: dto.type ?? old.type,
        assetId: dto.assetId === undefined ? old.asset_id : dto.assetId,
        locationId:
          dto.locationId === undefined ? old.location_id : dto.locationId,
      }
      if (!next.subject || !next.description) {
        throw new BadRequestException('Subject and description are required')
      }
      if (
        dto.subject === undefined &&
        dto.description === undefined &&
        dto.categoryId === undefined &&
        dto.priority === undefined &&
        dto.type === undefined &&
        dto.assetId === undefined &&
        dto.locationId === undefined
      ) {
        throw new BadRequestException('At least one editable field is required')
      }
      if (dto.categoryId !== undefined) {
        await this.assertActiveCategory(manager, dto.categoryId)
      }
      if (dto.assetId !== undefined) {
        await this.assertTicketAsset(manager, dto.assetId ?? undefined, user)
      }
      if (dto.locationId !== undefined) {
        await this.assertActiveLocation(manager, dto.locationId ?? undefined)
      }
      await manager.query(
        `UPDATE public.tickets
         SET subject = $2, description = $3, category_id = $4, priority = $5,
             asset_id = $6, location_id = $7, type = $8, updated_at = now()
         WHERE id = $1`,
        [
          id,
          next.subject,
          next.description,
          next.categoryId,
          next.priority,
          next.assetId,
          next.locationId,
          next.type,
        ],
      )
      await writeAuditLog(
        manager,
        request,
        user.id,
        'tickets.updated',
        'ticket',
        id,
        ticketAuditValues(old),
        next,
      )
      if (old.type !== next.type) {
        await manager.query(
          `INSERT INTO public.ticket_type_history
             (ticket_id, previous_type, new_type, changed_by)
           VALUES ($1, $2, $3, $4)`,
          [id, old.type, next.type, user.id],
        )
        await writeAuditLog(
          manager,
          request,
          user.id,
          'tickets.type_changed',
          'ticket',
          id,
          { type: old.type },
          { type: next.type },
        )
      }
      return id
    })
    return this.get(result, user)
  }

  async setStatus(
    id: string,
    dto: TicketStatusDto,
    user: AuthenticatedUser,
    request: Request,
  ): Promise<TicketResponse> {
    await this.dataSource.transaction(async (manager) => {
      const old = await this.getTicket(manager, id, true)
      assertCanModifyAssignedTicket(old, user)
      if (!canTransitionTicket(old.status, dto.status)) {
        throw new ConflictException(
          `Ticket cannot transition from ${old.status} to ${dto.status}`,
        )
      }
      const reason = clean(dto.reason)
      const resolutionSummary = clean(dto.resolutionSummary)
      if (dto.status === 'RESOLVED' && !resolutionSummary) {
        throw new BadRequestException(
          'A resolution summary is required to resolve a ticket',
        )
      }
      if (dto.status !== 'RESOLVED' && dto.resolutionSummary !== undefined) {
        throw new BadRequestException(
          'Resolution summary is only accepted when resolving a ticket',
        )
      }

      await manager.query(
        `UPDATE public.tickets
         SET status = $2::text,
             resolution_summary = CASE
               WHEN $2::text = 'RESOLVED' THEN $3
               WHEN $1::text = 'RESOLVED' AND $2::text = 'IN_PROGRESS' THEN NULL
               ELSE resolution_summary
             END,
             resolved_at = CASE
               WHEN $2::text = 'RESOLVED' THEN now()
               WHEN $1::text = 'RESOLVED' AND $2::text = 'IN_PROGRESS' THEN NULL
               ELSE resolved_at
             END,
             closed_at = CASE WHEN $2::text = 'CLOSED' THEN now() ELSE NULL END,
             updated_at = now()
         WHERE id = $4`,
        [old.status, dto.status, resolutionSummary, id],
      )
      await manager.query(
        `INSERT INTO public.ticket_status_history
           (ticket_id, previous_status, new_status, changed_by, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, old.status, dto.status, user.id, reason],
      )
      await writeAuditLog(
        manager,
        request,
        user.id,
        'tickets.status_changed',
        'ticket',
        id,
        { status: old.status },
        { status: dto.status, reason },
      )
    })
    return this.get(id, user)
  }

  async assign(
    id: string,
    dto: AssignTicketDto,
    user: AuthenticatedUser,
    request: Request,
  ): Promise<TicketResponse> {
    if (dto.assigneeId === undefined) {
      throw new BadRequestException(
        'assigneeId is required; use null to unassign the ticket',
      )
    }
    const assigneeId = dto.assigneeId
    await this.dataSource.transaction(async (manager) => {
      const ticket = await this.getTicket(manager, id, true)
      assertCanModifyAssignedTicket(ticket, user)
      assertEditableStatus(ticket.status)
      if (assigneeId === ticket.assigned_to) {
        throw new ConflictException('Ticket is already assigned to this user')
      }
      if (assigneeId !== null) {
        await this.assertEligibleAssignee(manager, assigneeId)
      }

      await manager.query(
        `UPDATE public.ticket_assignments
         SET unassigned_at = now()
         WHERE ticket_id = $1 AND unassigned_at IS NULL`,
        [id],
      )
      if (assigneeId) {
        await manager.query(
          `INSERT INTO public.ticket_assignments
             (ticket_id, assignee_id, assigned_by, notes)
           VALUES ($1, $2, $3, $4)`,
          [id, assigneeId, user.id, clean(dto.reason)],
        )
      }
      await manager.query(
        `UPDATE public.tickets
         SET assigned_to = $2, updated_at = now()
         WHERE id = $1`,
        [id, assigneeId],
      )
      await writeAuditLog(
        manager,
        request,
        user.id,
        'tickets.assignment_changed',
        'ticket',
        id,
        { assigneeId: ticket.assigned_to },
        { assigneeId, reason: clean(dto.reason) },
      )
    })
    return this.get(id, user)
  }

  async listAssignees(): Promise<Array<{ id: string; fullName: string }>> {
    const rows = (await this.dataSource.query(
      `SELECT DISTINCT u.id, u.full_name
       FROM public.users u
       JOIN public.user_roles ur ON ur.user_id = u.id
       JOIN public.roles r ON r.id = ur.role_id
       WHERE u.is_active = true AND u.deleted_at IS NULL
         AND r.code = 'IT_SUPPORT'
       ORDER BY u.full_name, u.id`,
    )) as Array<{ id: string; full_name: string }>
    return rows.map((row) => ({ id: row.id, fullName: row.full_name }))
  }

  async selfAssign(
    id: string,
    user: AuthenticatedUser,
    request: Request,
  ): Promise<TicketResponse> {
    await this.dataSource.transaction(async (manager) => {
      const rows = (await manager.query(
        `UPDATE public.tickets SET assigned_to = $2, updated_at = now()
         WHERE id = $1 AND assigned_to IS NULL AND deleted_at IS NULL
           AND status NOT IN ('CLOSED', 'CANCELLED')
         RETURNING id`,
        [id, user.id],
      )) as Array<{ id: string }>
      if (!rows.length) {
        const exists = (await manager.query(
          `SELECT id FROM public.tickets WHERE id = $1 AND deleted_at IS NULL`,
          [id],
        )) as unknown[]
        if (!exists.length) throw new NotFoundException('Ticket not found')
        throw new ConflictException(
          'Ticket was already assigned. Refresh the queue.',
        )
      }
      await manager.query(
        `INSERT INTO public.ticket_assignments (ticket_id, assignee_id, assigned_by)
         VALUES ($1, $2, $2)`,
        [id, user.id],
      )
      await writeAuditLog(
        manager,
        request,
        user.id,
        'tickets.self_assigned',
        'ticket',
        id,
        null,
        { assigneeId: user.id },
      )
    })
    return this.get(id, user)
  }

  async comments(
    id: string,
    user: AuthenticatedUser,
  ): Promise<
    Array<{
      id: string
      body: string
      isInternal: boolean
      author: { id: string; fullName: string }
      createdAt: Date
    }>
  > {
    const ticket = await this.getTicket(this.dataSource.manager, id)
    assertCanReadTicket(ticket, user)
    const canViewInternal =
      user.permissions.includes('tickets.update') ||
      user.permissions.includes('tickets.update.assigned')
    const rows = (await this.dataSource.query(
      `SELECT c.id, c.body, c.is_internal, c.author_id,
              u.full_name AS author_name, c.created_at
       FROM public.ticket_comments c
       JOIN public.users u ON u.id = c.author_id
       WHERE c.ticket_id = $1 AND c.deleted_at IS NULL
         AND ($2::boolean OR c.is_internal = false)
       ORDER BY c.created_at, c.id`,
      [id, canViewInternal],
    )) as Array<{
      id: string
      body: string
      is_internal: boolean
      author_id: string
      author_name: string
      created_at: Date
    }>
    return rows.map((row) => ({
      id: row.id,
      body: row.body,
      isInternal: row.is_internal,
      author: { id: row.author_id, fullName: row.author_name },
      createdAt: row.created_at,
    }))
  }

  async addComment(
    id: string,
    dto: CreateCommentDto,
    user: AuthenticatedUser,
    request: Request,
  ): Promise<void> {
    const body = dto.body.trim()
    if (!body) throw new BadRequestException('Comment body is required')
    if (
      dto.isInternal &&
      !user.permissions.includes('tickets.update') &&
      !user.permissions.includes('tickets.update.assigned')
    ) {
      throw new ForbiddenException('Internal notes are restricted')
    }
    await this.dataSource.transaction(async (manager) => {
      const ticket = await this.getTicket(manager, id, true)
      assertCanModifyAssignedTicket(ticket, user)
      assertCanReadTicket(ticket, user)
      assertEditableStatus(ticket.status)
      const rows = (await manager.query(
        `INSERT INTO public.ticket_comments
           (ticket_id, author_id, body, is_internal)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [id, user.id, body, dto.isInternal ?? false],
      )) as Array<{ id: string }>
      await writeAuditLog(
        manager,
        request,
        user.id,
        dto.isInternal
          ? 'tickets.internal_note_added'
          : 'tickets.comment_added',
        'ticket_comment',
        rows[0].id,
        null,
        { ticketId: id, isInternal: dto.isInternal ?? false },
      )
    })
  }

  async history(
    id: string,
    user: AuthenticatedUser,
  ): Promise<{
    statuses: Array<{
      previousStatus: string | null
      newStatus: string
      reason: string | null
      changedBy: string | null
      changedByName: string | null
      changedAt: Date
    }>
    assignments: Array<{
      assigneeId: string
      assigneeName: string
      assignedBy: string | null
      assignedByName: string | null
      assignedAt: Date
      unassignedAt: Date | null
      reason: string | null
    }>
    types: Array<{
      previousType: string
      newType: string
      changedBy: string | null
      changedByName: string | null
      changedAt: Date
    }>
  }> {
    const ticket = await this.getTicket(this.dataSource.manager, id)
    assertCanReadTicket(ticket, user)
    const [statuses, types, assignments] = (await Promise.all([
      this.dataSource.query(
        `SELECT h.previous_status, h.new_status, h.reason, h.changed_by,
                actor.full_name AS changed_by_name, h.changed_at
         FROM public.ticket_status_history h
         LEFT JOIN public.users actor ON actor.id = h.changed_by
         WHERE h.ticket_id = $1 ORDER BY h.changed_at, h.id`,
        [id],
      ),
      this.dataSource.query(
        `SELECT h.previous_type, h.new_type, h.changed_by,
                actor.full_name AS changed_by_name, h.changed_at
         FROM public.ticket_type_history h
         LEFT JOIN public.users actor ON actor.id = h.changed_by
         WHERE h.ticket_id = $1 ORDER BY h.changed_at, h.id`,
        [id],
      ),
      this.dataSource.query(
        `SELECT a.assignee_id, assignee.full_name AS assignee_name,
                a.assigned_by, actor.full_name AS assigned_by_name,
                a.assigned_at, a.unassigned_at, a.notes
         FROM public.ticket_assignments a
         JOIN public.users assignee ON assignee.id = a.assignee_id
         LEFT JOIN public.users actor ON actor.id = a.assigned_by
         WHERE a.ticket_id = $1 ORDER BY a.assigned_at, a.id`,
        [id],
      ),
    ])) as [
      Array<{
        previous_status: string | null
        new_status: string
        reason: string | null
        changed_by: string | null
        changed_by_name: string | null
        changed_at: Date
      }>,
      Array<{
        previous_type: string
        new_type: string
        changed_by: string | null
        changed_by_name: string | null
        changed_at: Date
      }>,
      Array<{
        assignee_id: string
        assignee_name: string
        assigned_by: string | null
        assigned_by_name: string | null
        assigned_at: Date
        unassigned_at: Date | null
        notes: string | null
      }>,
    ]
    return {
      statuses: statuses.map((row) => ({
        previousStatus: row.previous_status,
        newStatus: row.new_status,
        reason: row.reason,
        changedBy: row.changed_by,
        changedByName: row.changed_by_name,
        changedAt: row.changed_at,
      })),
      assignments: assignments.map((row) => ({
        assigneeId: row.assignee_id,
        assigneeName: row.assignee_name,
        assignedBy: row.assigned_by,
        assignedByName: row.assigned_by_name,
        assignedAt: row.assigned_at,
        unassignedAt: row.unassigned_at,
        reason: row.notes,
      })),
      types: types.map((row) => ({
        previousType: row.previous_type,
        newType: row.new_type,
        changedBy: row.changed_by,
        changedByName: row.changed_by_name,
        changedAt: row.changed_at,
      })),
    }
  }

  async listCategories(
    includeInactive: boolean,
  ): Promise<TicketCategoryResponse[]> {
    const rows = (await this.dataSource.query(
      `SELECT id, code, name, description, is_active, created_at
       FROM public.ticket_categories
       WHERE $1::boolean OR is_active = true
       ORDER BY name, id`,
      [includeInactive],
    )) as TicketCategoryRow[]
    return rows.map(toCategoryResponse)
  }

  async createCategory(
    dto: CreateTicketCategoryDto,
    user: AuthenticatedUser,
    request: Request,
  ): Promise<TicketCategoryResponse> {
    const code = dto.code.trim().toUpperCase()
    const name = dto.name.trim()
    if (!code || !name) {
      throw new BadRequestException('Category code and name are required')
    }
    try {
      const row = await this.dataSource.transaction(async (manager) => {
        const rows = (await manager.query(
          `INSERT INTO public.ticket_categories (code, name, description)
           VALUES ($1, $2, $3)
           RETURNING id, code, name, description, is_active, created_at`,
          [code, name, clean(dto.description)],
        )) as TicketCategoryRow[]
        await writeAuditLog(
          manager,
          request,
          user.id,
          'ticket_categories.created',
          'ticket_category',
          rows[0].id,
          null,
          { code: rows[0].code, name: rows[0].name },
        )
        return rows[0]
      })
      return toCategoryResponse(row)
    } catch (error) {
      if (postgresCode(error) === '23505') {
        throw new ConflictException('Ticket category code already exists')
      }
      throw error
    }
  }

  async updateCategory(
    id: string,
    dto: UpdateTicketCategoryDto,
    user: AuthenticatedUser,
    request: Request,
  ): Promise<TicketCategoryResponse> {
    const row = await this.dataSource.transaction(async (manager) => {
      const oldRows = (await manager.query(
        `SELECT id, code, name, description, is_active, created_at
         FROM public.ticket_categories WHERE id = $1 FOR UPDATE`,
        [id],
      )) as TicketCategoryRow[]
      const old = oldRows[0]
      if (!old) throw new NotFoundException('Ticket category not found')
      const nextName = dto.name?.trim() ?? old.name
      const nextDescription =
        dto.description === undefined ? old.description : clean(dto.description)
      if (!nextName) throw new BadRequestException('Category name is required')
      if (nextName === old.name && nextDescription === old.description) {
        return old
      }
      const rows = (await manager.query(
        `UPDATE public.ticket_categories SET name = $2, description = $3
         WHERE id = $1
         RETURNING id, code, name, description, is_active, created_at`,
        [id, nextName, nextDescription],
      )) as TicketCategoryRow[]
      await writeAuditLog(
        manager,
        request,
        user.id,
        'ticket_categories.updated',
        'ticket_category',
        id,
        { name: old.name, description: old.description },
        { name: nextName, description: nextDescription },
      )
      return rows[0]
    })
    return toCategoryResponse(row)
  }

  async setCategoryStatus(
    id: string,
    dto: TicketCategoryStatusDto,
    user: AuthenticatedUser,
    request: Request,
  ): Promise<TicketCategoryResponse> {
    const row = await this.dataSource.transaction(async (manager) => {
      const oldRows = (await manager.query(
        `SELECT id, code, name, description, is_active, created_at
         FROM public.ticket_categories WHERE id = $1 FOR UPDATE`,
        [id],
      )) as TicketCategoryRow[]
      const old = oldRows[0]
      if (!old) throw new NotFoundException('Ticket category not found')
      if (old.is_active === dto.isActive) return old
      const rows = (await manager.query(
        `UPDATE public.ticket_categories SET is_active = $2
         WHERE id = $1
         RETURNING id, code, name, description, is_active, created_at`,
        [id, dto.isActive],
      )) as TicketCategoryRow[]
      await writeAuditLog(
        manager,
        request,
        user.id,
        'ticket_categories.status_changed',
        'ticket_category',
        id,
        { isActive: old.is_active },
        { isActive: dto.isActive },
      )
      return rows[0]
    })
    return toCategoryResponse(row)
  }

  private async getTicket(
    manager: EntityManager,
    id: string,
    forUpdate = false,
  ): Promise<TicketRow> {
    const rows = (await manager.query(
      `${TICKET_SELECT}
       WHERE t.id = $1 AND t.deleted_at IS NULL${forUpdate ? ' FOR UPDATE OF t' : ''}`,
      [id],
    )) as TicketRow[]
    if (!rows[0]) throw new NotFoundException('Ticket not found')
    return rows[0]
  }

  private async assertActiveCategory(
    manager: EntityManager,
    id: string,
  ): Promise<void> {
    const rows = (await manager.query(
      `SELECT 1 FROM public.ticket_categories
       WHERE id = $1 AND is_active = true`,
      [id],
    )) as unknown[]
    if (!rows.length) {
      throw new BadRequestException('Select an active ticket category')
    }
  }

  private async assertActiveLocation(
    manager: EntityManager,
    id: string | undefined,
  ): Promise<void> {
    if (!id) return
    const rows = (await manager.query(
      `SELECT 1 FROM public.locations WHERE id = $1 AND is_active = true`,
      [id],
    )) as unknown[]
    if (!rows.length) throw new BadRequestException('Select an active location')
  }

  private async assertTicketAsset(
    manager: EntityManager,
    id: string | undefined,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (!id) return
    const canReadAll = user.permissions.includes('tickets.read.all')
    const rows = (await manager.query(
      `SELECT a.id
       FROM public.assets a
       WHERE a.id = $1
         AND ($2::boolean OR EXISTS (
           SELECT 1 FROM public.asset_assignments aa
           WHERE aa.asset_id = a.id AND aa.user_id = $3
             AND aa.returned_at IS NULL
         ) OR a.is_shared = true)`,
      [id, canReadAll, user.id],
    )) as unknown[]
    if (!rows.length) {
      throw new BadRequestException(
        'The selected asset is unavailable for this ticket',
      )
    }
  }

  private async assertEligibleAssignee(
    manager: EntityManager,
    id: string,
  ): Promise<void> {
    const rows = (await manager.query(
      `SELECT u.id
       FROM public.users u
       WHERE u.id = $1 AND u.is_active = true AND u.deleted_at IS NULL
         AND EXISTS (
           SELECT 1
           FROM public.user_roles ur
           JOIN public.roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id AND r.code = 'IT_SUPPORT'
         )`,
      [id],
    )) as unknown[]
    if (!rows.length) {
      throw new BadRequestException(
        'Assignee must be an active user with ticket update permission',
      )
    }
  }
}

function assertCanReadTicket(ticket: TicketRow, user: AuthenticatedUser): void {
  if (
    !user.permissions.includes('tickets.read.all') &&
    (!user.permissions.includes('tickets.read.own') ||
      ticket.requester_id !== user.id)
  ) {
    throw new NotFoundException('Ticket not found')
  }
}

function assertCanModifyAssignedTicket(
  ticket: TicketRow,
  user: AuthenticatedUser,
): void {
  if (
    user.permissions.includes('tickets.update.assigned') &&
    !user.permissions.includes('tickets.update') &&
    ticket.assigned_to !== user.id
  ) {
    throw new ForbiddenException('You can only change tickets assigned to you')
  }
}

function assertEditableStatus(status: TicketStatus): void {
  if (status === 'CLOSED' || status === 'CANCELLED') {
    throw new ConflictException('Closed or cancelled tickets cannot be changed')
  }
}

function toTicketResponse(row: TicketRow): TicketResponse {
  return {
    id: row.id,
    ticketNumber: `TCK-${row.ticket_year}-${row.ticket_number.padStart(6, '0')}`,
    subject: row.subject,
    description: row.description,
    requester: { id: row.requester_id, fullName: row.requester_name },
    assignee:
      row.assigned_to && row.assignee_name
        ? { id: row.assigned_to, fullName: row.assignee_name }
        : null,
    category:
      row.category_id && row.category_code && row.category_name
        ? {
            id: row.category_id,
            code: row.category_code,
            name: row.category_name,
          }
        : null,
    asset:
      row.asset_id && row.asset_tag && row.asset_name
        ? { id: row.asset_id, assetTag: row.asset_tag, name: row.asset_name }
        : null,
    location:
      row.location_id && row.location_code && row.location_name
        ? {
            id: row.location_id,
            code: row.location_code,
            name: row.location_name,
          }
        : null,
    priority: row.priority,
    status: row.status,
    type: row.type,
    resolutionSummary: row.resolution_summary,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toCategoryResponse(row: TicketCategoryRow): TicketCategoryResponse {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

function clean(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const result = value.trim()
  return result || null
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

function ticketAuditValues(row: TicketRow): Record<string, unknown> {
  return {
    subject: row.subject,
    categoryId: row.category_id,
    priority: row.priority,
    assetId: row.asset_id,
    locationId: row.location_id,
  }
}

function postgresCode(error: unknown): string | null {
  const code = getPostgresErrorCode(error)
  if (code) return code
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code
  }
  return null
}
