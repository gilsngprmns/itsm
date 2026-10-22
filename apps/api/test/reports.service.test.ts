import { BadRequestException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { describe, expect, it, vi } from 'vitest'
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
      resolvedInPeriod: 1,
      trend: [{ date: '2026-10-19', count: 2 }],
    })
    expect(dataSource.query.mock.calls[0][0]).toContain('created_at < $2::date')
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
        endDate: '2026-01-04',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(dataSource.query).not.toHaveBeenCalled()
  })
})
