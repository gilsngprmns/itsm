import { BadRequestException, Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import type { ReportsQueryDto } from './dto/reports-query.dto'

export interface CountRow {
  name: string
  count: number
}

interface Period {
  startDate: string
  endDate: string
  endExclusive: string
}

@Injectable()
export class ReportsService {
  constructor(private readonly dataSource: DataSource) {}

  async overview(query: ReportsQueryDto) {
    const period = getPeriod(query)
    const [tickets, assets, ticketTrend, resolved, recentActivity] =
      await Promise.all([
        this.ticketSummary(period),
        this.assetSummary(),
        this.ticketTrend(period),
        this.resolvedCount(period),
        this.activity(),
      ])
    return {
      period: { startDate: period.startDate, endDate: period.endDate },
      tickets: { ...tickets, resolvedInPeriod: resolved, trend: ticketTrend },
      assets,
      recentActivity,
    }
  }

  async tickets(query: ReportsQueryDto) {
    const period = getPeriod(query)
    const [summary, trend, resolved] = await Promise.all([
      this.ticketSummary(period),
      this.ticketTrend(period),
      this.resolvedCount(period),
    ])
    return {
      period: { startDate: period.startDate, endDate: period.endDate },
      ...summary,
      resolvedInPeriod: resolved,
      trend,
    }
  }

  async assets() {
    return this.assetSummary()
  }

  async activity() {
    const rows = (await this.dataSource.query(
      `SELECT l.id, l.action, l.entity_type, l.entity_id, l.created_at,
              l.actor_id, u.full_name AS actor_name
       FROM public.audit_logs l
       LEFT JOIN public.users u ON u.id = l.actor_id
       ORDER BY l.created_at DESC, l.id
       LIMIT 10`,
    )) as Array<{
      id: string
      action: string
      entity_type: string
      entity_id: string | null
      created_at: Date
      actor_id: string | null
      actor_name: string | null
    }>
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      createdAt: row.created_at,
      actor:
        row.actor_id === null
          ? null
          : {
              id: row.actor_id,
              fullName: row.actor_name ?? 'Unknown user',
            },
    }))
  }

  private async ticketSummary(period: Period) {
    const [totalRows, statuses, priorities, categories] = await Promise.all([
      this.dataSource.query(
        `SELECT count(*)::int AS total
         FROM public.tickets
         WHERE deleted_at IS NULL AND created_at >= $1::date
           AND created_at < $2::date`,
        [period.startDate, period.endExclusive],
      ) as Promise<Array<{ total: number }>>,
      this.countsBy(
        `SELECT status::text AS name, count(*)::int AS count
         FROM public.tickets
         WHERE deleted_at IS NULL AND created_at >= $1::date
           AND created_at < $2::date
         GROUP BY status ORDER BY status`,
        [period.startDate, period.endExclusive],
      ),
      this.countsBy(
        `SELECT priority::text AS name, count(*)::int AS count
         FROM public.tickets
         WHERE deleted_at IS NULL AND created_at >= $1::date
           AND created_at < $2::date
         GROUP BY priority ORDER BY priority`,
        [period.startDate, period.endExclusive],
      ),
      this.countsBy(
        `SELECT COALESCE(c.name, 'Uncategorized') AS name, count(t.id)::int AS count
         FROM public.tickets t
         LEFT JOIN public.ticket_categories c ON c.id = t.category_id
         WHERE t.deleted_at IS NULL AND t.created_at >= $1::date
           AND t.created_at < $2::date
         GROUP BY c.id, c.name ORDER BY name`,
        [period.startDate, period.endExclusive],
      ),
    ])
    return {
      totalCreated: Number(totalRows[0]?.total ?? 0),
      byStatus: statuses,
      byPriority: priorities,
      byCategory: categories,
    }
  }

  private async ticketTrend(period: Period) {
    const rows = (await this.dataSource.query(
      `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
              count(*)::int AS count
       FROM public.tickets
       WHERE deleted_at IS NULL AND created_at >= $1::date
         AND created_at < $2::date
       GROUP BY date ORDER BY date`,
      [period.startDate, period.endExclusive],
    )) as Array<{ date: string; count: number }>
    return rows.map((row) => ({ date: row.date, count: Number(row.count) }))
  }

  private async resolvedCount(period: Period): Promise<number> {
    const rows = (await this.dataSource.query(
      `SELECT count(*)::int AS total
       FROM public.tickets
       WHERE deleted_at IS NULL AND resolved_at >= $1::date
         AND resolved_at < $2::date`,
      [period.startDate, period.endExclusive],
    )) as Array<{ total: number }>
    return Number(rows[0]?.total ?? 0)
  }

  private async assetSummary() {
    const [totalRows, rows, categories, locations] = await Promise.all([
      this.dataSource.query(
        `SELECT count(*)::int AS total FROM public.assets WHERE deleted_at IS NULL`,
      ) as Promise<Array<{ total: number }>>,
      this.countsBy(
        `SELECT status::text AS name, count(*)::int AS count
         FROM public.assets WHERE deleted_at IS NULL
         GROUP BY status ORDER BY status`,
      ),
      this.countsBy(
        `SELECT c.name, count(a.id)::int AS count
         FROM public.asset_categories c
         LEFT JOIN public.assets a
           ON a.category_id = c.id AND a.deleted_at IS NULL
         GROUP BY c.id, c.name ORDER BY c.name`,
      ),
      this.countsBy(
        `SELECT COALESCE(l.name, 'Unassigned') AS name, count(a.id)::int AS count
         FROM public.assets a
         LEFT JOIN public.locations l ON l.id = a.location_id
         WHERE a.deleted_at IS NULL
         GROUP BY l.id, l.name ORDER BY name`,
      ),
    ])
    return {
      total: Number(totalRows[0]?.total ?? 0),
      byStatus: rows,
      byCategory: categories,
      byLocation: locations,
    }
  }

  private async countsBy(
    sql: string,
    parameters: unknown[] = [],
  ): Promise<CountRow[]> {
    const rows = (await this.dataSource.query(sql, parameters)) as CountRow[]
    return rows.map((row) => ({ name: row.name, count: Number(row.count) }))
  }
}

function getPeriod(query: ReportsQueryDto): Period {
  const today = new Date().toISOString().slice(0, 10)
  const endDate = query.endDate?.slice(0, 10) ?? today
  const defaultStartDate = new Date(
    Date.parse(`${endDate}T00:00:00Z`) - 29 * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10)
  const startDate = query.startDate?.slice(0, 10) ?? defaultStartDate
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const end = Date.parse(`${endDate}T00:00:00Z`)
  if (start > end) {
    throw new BadRequestException('startDate must be on or before endDate')
  }
  if (end - start > 366 * 24 * 60 * 60 * 1000) {
    throw new BadRequestException('Date range cannot exceed 367 calendar days')
  }
  const endExclusive = new Date(end + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  return { startDate, endDate, endExclusive }
}
