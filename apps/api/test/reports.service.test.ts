import { BadRequestException } from '@nestjs/common'
import { validate } from 'class-validator'
import { DataSource } from 'typeorm'
import { describe, expect, it, vi } from 'vitest'
import { ReportsQueryDto } from '../src/modules/reports/dto/reports-query.dto'
import { ReportsService } from '../src/modules/reports/reports.service'

function createService() {
  const dataSource = { query: vi.fn() }
  return {
    dataSource,
    service: new ReportsService(dataSource as unknown as DataSource),
  }
}

describe('ReportsService', () => {
  it('aggregates ticket counts in PostgreSQL using an inclusive date range', async () => {
    const { dataSource, service } = createService()
    dataSource.query
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([{ name: 'OPEN', count: 1 }])
      .mockResolvedValueOnce([{ name: 'HIGH', count: 1 }])
      .mockResolvedValueOnce([{ name: 'Network', count: 2 }])
      .mockResolvedValueOnce([{ name: 'INCIDENT', count: 2 }])
      .mockResolvedValueOnce([{ date: '2026-10-19', count: 2 }])
      .mockResolvedValueOnce([{ total: 1 }])

    const result = await service.tickets({
      startDate: '2026-10-19',
      endDate: '2026-10-19',
    })

    expect(result).toEqual({
      period: { startDate: '2026-10-19', endDate: '2026-10-19' },
      totalCreated: 2,
      byStatus: [{ name: 'OPEN', count: 1 }],
      byPriority: [{ name: 'HIGH', count: 1 }],
      byCategory: [{ name: 'Network', count: 2 }],
      byType: [{ name: 'INCIDENT', count: 2 }],
      resolvedInPeriod: 1,
      trend: [{ date: '2026-10-19', count: 2 }],
    })
    expect(dataSource.query.mock.calls[0][0]).toContain(
      "created_at < ($2::date::timestamp AT TIME ZONE 'UTC')",
    )
    expect(dataSource.query.mock.calls[0][1]).toEqual([
      '2026-10-19',
      '2026-10-20',
    ])
    expect(dataSource.query.mock.calls[3][0]).toContain(
      'LEFT JOIN public.ticket_categories',
    )
  })

  it('returns zero-valued reports when PostgreSQL has no matching records', async () => {
    const { dataSource, service } = createService()
    dataSource.query
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }])

    const result = await service.tickets({
      startDate: '2026-10-19',
      endDate: '2026-10-19',
    })

    expect(result.totalCreated).toBe(0)
    expect(result.byStatus).toEqual([])
    expect(result.byPriority).toEqual([])
    expect(result.byCategory).toEqual([])
    expect(result.trend).toEqual([])
    expect(result.resolvedInPeriod).toBe(0)
  })

  it('accepts the maximum inclusive date range', async () => {
    const { dataSource, service } = createService()
    dataSource.query.mockResolvedValue([])

    const result = await service.tickets({
      startDate: '2025-01-01',
      endDate: '2026-01-02',
    })

    expect(result.period).toEqual({
      startDate: '2025-01-01',
      endDate: '2026-01-02',
    })
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining(
        "created_at < ($2::date::timestamp AT TIME ZONE 'UTC')",
      ),
      ['2025-01-01', '2026-01-03'],
    )
  })

  it('defaults to the last 30 UTC calendar dates when dates are omitted', async () => {
    const { dataSource, service } = createService()
    dataSource.query.mockResolvedValue([])
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-26T23:30:00-07:00'))

    try {
      const result = await service.tickets({})

      expect(result.period).toEqual({
        startDate: '2026-09-28',
        endDate: '2026-10-27',
      })
      expect(dataSource.query.mock.calls[0][1]).toEqual([
        '2026-09-28',
        '2026-10-28',
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects timestamps and impossible calendar dates before querying PostgreSQL', async () => {
    const { dataSource, service } = createService()

    await expect(
      service.tickets({
        startDate: '2026-10-01T00:00:00Z',
        endDate: '2026-10-02',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.tickets({
        startDate: '2026-02-29',
        endDate: '2026-03-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.tickets({
        startDate: '2026-10-01',
        endDate: '2026-10-02+07:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(dataSource.query).not.toHaveBeenCalled()
  })

  it('validates date-only query DTOs and rejects unsupported timestamps', async () => {
    const valid = Object.assign(new ReportsQueryDto(), {
      startDate: '2024-02-29',
      endDate: '2024-03-01',
    })
    const timestamp = Object.assign(new ReportsQueryDto(), {
      startDate: '2024-02-29T00:00:00Z',
      endDate: '2024-03-01',
    })

    await expect(validate(valid)).resolves.toHaveLength(0)
    await expect(validate(timestamp)).resolves.not.toHaveLength(0)
  })

  it('rejects invalid date ranges before querying the database', async () => {
    const { dataSource, service } = createService()

    await expect(
      service.tickets({
        startDate: '2026-10-20',
        endDate: '2026-10-19',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.tickets({
        startDate: '2025-01-01',
        endDate: '2026-01-03',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(dataSource.query).not.toHaveBeenCalled()
  })
})
