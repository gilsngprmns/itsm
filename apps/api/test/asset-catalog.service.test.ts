import { ConflictException } from '@nestjs/common'
import type { Request } from 'express'
import { DataSource } from 'typeorm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssetCatalogService } from '../src/modules/asset-catalog/asset-catalog.service'

const request = {
  ip: '127.0.0.1',
  headers: { 'user-agent': 'asset-catalog-test' },
} as Request

describe('AssetCatalogService master data', () => {
  let dataSource: DataSource
  let managerQuery: ReturnType<typeof vi.spyOn>
  let dataSourceQuery: ReturnType<typeof vi.spyOn>
  let service: AssetCatalogService

  beforeEach(() => {
    dataSource = new DataSource({
      type: 'postgres',
      url: 'postgres://localhost/it_db',
    })
    managerQuery = vi.spyOn(dataSource.manager, 'query')
    dataSourceQuery = vi.spyOn(dataSource, 'query')
    vi.spyOn(dataSource, 'transaction').mockImplementation((async (
      ...args: unknown[]
    ) => {
      const runInTransaction = args[args.length - 1]
      if (typeof runInTransaction !== 'function') {
        throw new Error('Expected a TypeORM transaction callback')
      }
      return runInTransaction(dataSource.manager)
    }) as typeof dataSource.transaction)
    service = new AssetCatalogService(dataSource)
  })

  it('lists departments with member counts and active state', async () => {
    dataSourceQuery.mockResolvedValueOnce([
      {
        id: 'department-id',
        code: 'IT',
        name: 'Information Technology',
        description: null,
        is_active: true,
        member_count: '3',
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-02T00:00:00Z'),
      },
    ])

    await expect(service.listDepartments()).resolves.toMatchObject([
      {
        id: 'department-id',
        code: 'IT',
        isActive: true,
        memberCount: 3,
      },
    ])
    expect(dataSourceQuery.mock.calls[0][0]).toContain('u.department_id = d.id')
    expect(dataSourceQuery.mock.calls[0][0]).toContain('u.deleted_at IS NULL')
    expect(dataSourceQuery.mock.calls[0][0]).toContain('u.is_active = true')
  })

  it('normalizes department codes and writes an audit row transactionally', async () => {
    const insertedRow = { id: 'department-id' }
    const departmentRow = {
      id: 'department-id',
      code: 'IT',
      name: 'Operations',
      description: null,
      is_active: true,
      member_count: 0,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z'),
    }
    managerQuery.mockResolvedValueOnce([insertedRow]).mockResolvedValueOnce([])
    dataSourceQuery.mockResolvedValueOnce([departmentRow])

    await service.createDepartment(
      { code: ' it ', name: ' Operations ' },
      'admin-id',
      request,
    )

    expect(managerQuery.mock.calls[0][1]).toEqual(['IT', 'Operations', null])
    expect(managerQuery.mock.calls[1][0]).toContain(
      'INSERT INTO public.audit_logs',
    )
    expect(managerQuery.mock.calls[1][1]).toContain('departments.created')
  })

  it('reports duplicate department codes as a conflict', async () => {
    managerQuery.mockRejectedValueOnce({
      driverError: { code: '23505' },
    })

    await expect(
      service.createDepartment(
        { code: 'IT', name: 'Information Technology' },
        'admin-id',
        request,
      ),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('audits department deactivation while preserving the record', async () => {
    managerQuery
      .mockResolvedValueOnce([
        {
          code: 'IT',
          name: 'Operations',
          description: null,
          is_active: true,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    dataSourceQuery.mockResolvedValueOnce([
      {
        id: 'department-id',
        code: 'IT',
        name: 'Operations',
        description: null,
        is_active: false,
        member_count: 0,
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-02T00:00:00Z'),
      },
    ])

    const result = await service.updateDepartment(
      'department-id',
      { isActive: false },
      'admin-id',
      request,
    )

    expect(result.isActive).toBe(false)
    expect(managerQuery.mock.calls[1][0]).toContain('UPDATE public.departments')
    expect(managerQuery.mock.calls[1][1]).toEqual([
      'department-id',
      'Operations',
      null,
      false,
    ])
    expect(managerQuery.mock.calls[2][1]).toContain(
      'departments.status_changed',
    )
  })

  it('lists vendors with both asset and maintenance reference counts', async () => {
    dataSourceQuery.mockResolvedValueOnce([
      {
        id: 'vendor-id',
        name: 'Example Vendor',
        contact_person: null,
        email: null,
        phone: null,
        address: null,
        website: null,
        notes: null,
        reference_count: '4',
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-02T00:00:00Z'),
      },
    ])

    await expect(service.listVendors()).resolves.toMatchObject([
      { id: 'vendor-id', name: 'Example Vendor', referenceCount: 4 },
    ])
    expect(dataSourceQuery.mock.calls[0][0]).toContain(
      'FROM public.asset_maintenance m',
    )
  })
})
