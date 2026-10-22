import { BadRequestException, Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import type { AuditQueryDto } from './dto/audit-query.dto'

interface AuditRow {
  id: string
  actor_id: string | null
  actor_name: string | null
  action: string
  entity_type: string
  entity_id: string | null
  created_at: Date
}

@Injectable()
export class AuditService {
  constructor(private readonly dataSource: DataSource) {}

  async list(query: AuditQueryDto): Promise<{
    items: Array<{
      id: string
      actor: { id: string; fullName: string } | null
      action: string
      entityType: string
      entityId: string | null
      createdAt: Date
    }>
    page: number
    limit: number
    total: number
  }> {
    validateDateRange(query.startDate, query.endDate)
    const values: unknown[] = []
    const conditions: string[] = []
    const add = (clause: (parameter: string) => string, value: unknown) => {
      values.push(value)
      conditions.push(clause(`$${values.length}`))
    }

    if (query.action) {
      add((parameter) => `l.action = ${parameter}`, query.action)
    }
    if (query.entityType) {
      add((parameter) => `l.entity_type = ${parameter}`, query.entityType)
    }
    if (query.entityId) {
      add((parameter) => `l.entity_id = ${parameter}`, query.entityId)
    }
    if (query.actorUserId) {
      add((parameter) => `l.actor_id = ${parameter}`, query.actorUserId)
    }
    if (query.startDate) {
      add((parameter) => `l.created_at >= ${parameter}::date`, query.startDate)
    }
    if (query.endDate) {
      add(
        (parameter) => `l.created_at < (${parameter}::date + interval '1 day')`,
        query.endDate,
      )
    }
    if (query.search?.trim()) {
      values.push(`%${escapeLike(query.search.trim())}%`)
      conditions.push(
        `(l.action ILIKE $${values.length} ESCAPE '\\'
          OR l.entity_type ILIKE $${values.length} ESCAPE '\\'
          OR l.entity_id::text ILIKE $${values.length} ESCAPE '\\'
          OR actor.full_name ILIKE $${values.length} ESCAPE '\\')`,
      )
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const join = 'LEFT JOIN public.users actor ON actor.id = l.actor_id'
    const countRows = (await this.dataSource.query(
      `SELECT count(*)::int AS total
       FROM public.audit_logs l ${join} ${where}`,
      values,
    )) as Array<{ total: number }>
    const limitParameter = values.length + 1
    const offsetParameter = values.length + 2
    const rows = (await this.dataSource.query(
      `SELECT l.id, l.actor_id, actor.full_name AS actor_name, l.action,
              l.entity_type, l.entity_id, l.created_at
       FROM public.audit_logs l ${join} ${where}
       ORDER BY l.created_at ${query.sortOrder.toUpperCase()}, l.id
       LIMIT $${limitParameter} OFFSET $${offsetParameter}`,
      [...values, query.limit, (query.page - 1) * query.limit],
    )) as AuditRow[]

    return {
      items: rows.map((row) => ({
        id: row.id,
        actor: row.actor_id
          ? { id: row.actor_id, fullName: row.actor_name ?? 'Unknown user' }
          : null,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        createdAt: row.created_at,
      })),
      page: query.page,
      limit: query.limit,
      total: Number(countRows[0]?.total ?? 0),
    }
  }
}

function validateDateRange(
  startDate: string | undefined,
  endDate: string | undefined,
): void {
  if (!startDate || !endDate) return
  const start = Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`)
  const end = Date.parse(`${endDate.slice(0, 10)}T00:00:00Z`)
  if (start > end) {
    throw new BadRequestException('startDate must be on or before endDate')
  }
  if (end - start > 366 * 24 * 60 * 60 * 1000) {
    throw new BadRequestException('Date range cannot exceed 367 calendar days')
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}
