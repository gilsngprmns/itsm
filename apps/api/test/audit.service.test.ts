import { BadRequestException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { describe, expect, it, vi } from 'vitest'
import { AuditService } from '../src/modules/audit/audit.service'

function createService() {
  const dataSource = { query: vi.fn() }
  return {
    dataSource,
    service: new AuditService(dataSource as unknown as DataSource),
  }
}

describe('AuditService', () => {
  it('filters and paginates audit events without returning sensitive metadata', async () => {
    const { dataSource, service } = createService()
    dataSource.query
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        {
          id: 'log-id',
          actor_id: 'actor-id',
          actor_name: 'Administrator',
          action: 'tickets.created',
          entity_type: 'ticket',
          entity_id: 'ticket-id',
          created_at: new Date('2026-10-19T00:00:00Z'),
        },
      ])

    const result = await service.list({
      search: 'ticket',
      action: 'tickets.created',
      entityType: 'ticket',
      actorUserId: 'actor-id',
      startDate: '2026-10-01',
      endDate: '2026-10-19',
      sortOrder: 'desc',
      page: 2,
      limit: 10,
    })

    expect(result).toMatchObject({
      page: 2,
      limit: 10,
      total: 1,
      items: [
        {
          actor: { id: 'actor-id', fullName: 'Administrator' },
          action: 'tickets.created',
          entityType: 'ticket',
          entityId: 'ticket-id',
        },
      ],
    })
    expect(dataSource.query.mock.calls[0][0]).toContain(
      "l.created_at < ($5::date + interval '1 day')",
    )
    expect(dataSource.query.mock.calls[0][1]).toEqual([
      'tickets.created',
      'ticket',
      'actor-id',
      '2026-10-01',
      '2026-10-19',
      '%ticket%',
    ])
    expect(dataSource.query.mock.calls[1][0]).not.toContain('old_values')
    expect(dataSource.query.mock.calls[1][0]).not.toContain('ip_address')
    expect(dataSource.query.mock.calls[1][1]).toEqual([
      'tickets.created',
      'ticket',
      'actor-id',
      '2026-10-01',
      '2026-10-19',
      '%ticket%',
      10,
      10,
    ])
    expect(JSON.stringify(result)).not.toContain('old_values')
  })

  it('rejects an inverted or excessively broad date range', async () => {
    const { service } = createService()

    await expect(
      service.list({
        startDate: '2026-10-20',
        endDate: '2026-10-19',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.list({
        startDate: '2025-01-01',
        endDate: '2026-01-04',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
