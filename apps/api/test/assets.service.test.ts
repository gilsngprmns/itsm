import { ConflictException, UnprocessableEntityException } from '@nestjs/common'
import type { Request } from 'express'
import { DataSource, type EntityManager } from 'typeorm'
import { describe, expect, it, vi } from 'vitest'
import QRCode from 'qrcode'
import { AssetsService } from '../src/modules/assets/assets.service'
import type { AuthenticatedUser } from '../src/modules/auth/auth.types'
import {
  ASSET_CSV_COLUMNS,
  type AssetCsvColumn,
} from '../src/modules/assets/asset-csv'

const admin: AuthenticatedUser = {
  id: 'admin-id',
  fullName: 'Admin',
  email: 'admin@example.test',
  roles: ['ADMIN'],
  permissions: [
    'assets.read',
    'assets.create',
    'assets.update',
    'assets.assign',
    'assets.retire',
  ],
}

const testRequest = {
  ip: '127.0.0.1',
  headers: { 'user-agent': 'assets-service-test' },
} as Request

function createService() {
  const manager = { query: vi.fn() }
  const dataSource = {
    manager,
    query: vi.fn(),
    transaction: vi.fn(
      async (callback: (manager: EntityManager) => Promise<unknown>) =>
        callback(manager as unknown as EntityManager),
    ),
  }
  return {
    manager,
    dataSource,
    service: new AssetsService(
      dataSource as unknown as DataSource,
      { get: vi.fn(() => 'http://localhost:5173') } as never,
    ),
  }
}

function assetRow(status: string) {
  return {
    id: 'asset-id',
    asset_code: 'AST-1',
    is_shared: false,
    asset_tag: 'IT-0001',
    name: 'Laptop',
    category_id: 'category-id',
    category_code: 'LAPTOP',
    category_name: 'Laptop',
    manufacturer: null,
    model: null,
    serial_number: null,
    description: null,
    status,
    condition: 'GOOD',
    purchase_date: null,
    purchase_cost: null,
    warranty_start: null,
    warranty_end: null,
    location_id: null,
    location_code: null,
    location_name: null,
    notes: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    assigned_user_id: null,
    assigned_user_name: null,
    assigned_user_employee_code: null,
  }
}

function csvRow(assetTag: string, name: string, categoryCode = 'LAPTOP') {
  const values: Partial<Record<AssetCsvColumn, string>> = {
    assetTag,
    name,
    categoryCode,
  }
  return ASSET_CSV_COLUMNS.map((column) => values[column] ?? '').join(',')
}

describe('AssetsService access and lifecycle', () => {
  it('limits ordinary user lists to their currently assigned assets', async () => {
    const { service, dataSource } = createService()
    dataSource.query
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([])
    const user: AuthenticatedUser = {
      ...admin,
      id: 'user-id',
      roles: ['USER'],
      permissions: ['assets.read'],
    }

    const result = await service.list({ page: 1, limit: 25 } as never, user)

    expect(result.total).toBe(0)
    expect(dataSource.query.mock.calls[0][0]).toContain(
      'own_assignment.user_id',
    )
    expect(dataSource.query.mock.calls[0][0]).toContain('a.is_shared = true')
    expect(dataSource.query.mock.calls[0][1]).toContain(user.id)
  })

  describe('AssetsService CSV operations', () => {
    it('validates CSV references and conflicts without writing during preview', async () => {
      const { service, manager } = createService()
      manager.query
        .mockResolvedValueOnce([{ id: 'category-id', code: 'LAPTOP' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ asset_tag: 'EXISTS', serial_number: null }])

      const preview = await service.previewCsvImport(
        Buffer.from(
          `${ASSET_CSV_COLUMNS.join(',')}\n${csvRow('EXISTS', 'Laptop')}`,
        ),
        'assets.csv',
      )

      expect(preview.invalidRows).toBe(1)
      expect(preview.rows[0].errors[0].code).toBe('already_exists')
      expect(manager.query).toHaveBeenCalledTimes(3)
      expect(
        manager.query.mock.calls.some(([sql]) =>
          String(sql).includes('INSERT'),
        ),
      ).toBe(false)
    })

    it('creates the complete CSV batch and records its audit summary transactionally', async () => {
      const { service, manager, dataSource } = createService()
      manager.query
        .mockResolvedValueOnce([{ id: 'category-id', code: 'LAPTOP' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([{ id: 'asset-1' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([{ id: 'asset-2' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await service.importCsv(
        Buffer.from(
          `${ASSET_CSV_COLUMNS.join(',')}\n${csvRow('ASSET-1', 'Laptop')}\n${csvRow('ASSET-2', 'Desktop')}`,
        ),
        'assets.csv',
        admin,
        testRequest,
      )

      expect(result).toMatchObject({
        mode: 'CREATE_ONLY',
        totalRows: 2,
        createdRows: 2,
        updatedRows: 0,
        rejectedRows: 0,
      })
      expect(dataSource.transaction).toHaveBeenCalledOnce()
      expect(
        manager.query.mock.calls.filter(([sql]) =>
          String(sql).includes('INSERT INTO public.assets'),
        ),
      ).toHaveLength(2)
      expect(manager.query.mock.calls.at(-1)?.[0]).toContain('audit_logs')
      expect(
        JSON.parse(String(manager.query.mock.calls.at(-1)?.[1]?.[5])),
      ).toMatchObject({ totalRows: 2, createdRows: 2 })
      expect(
        manager.query.mock.calls.some(([sql]) =>
          String(sql).includes('UPDATE public.assets'),
        ),
      ).toBe(false)
    })

    it('rejects the full batch before writing when validation finds a conflict', async () => {
      const { service, manager } = createService()
      manager.query
        .mockResolvedValueOnce([{ id: 'category-id', code: 'LAPTOP' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ asset_tag: 'TAKEN', serial_number: null }])

      await expect(
        service.importCsv(
          Buffer.from(
            `${ASSET_CSV_COLUMNS.join(',')}\n${csvRow('TAKEN', 'Laptop')}`,
          ),
          'assets.csv',
          admin,
          testRequest,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException)
      expect(manager.query).toHaveBeenCalledTimes(3)
    })

    it('converts a concurrent uniqueness race into a conflict response', async () => {
      const { service, manager } = createService()
      manager.query
        .mockResolvedValueOnce([{ id: 'category-id', code: 'LAPTOP' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockRejectedValueOnce({ driverError: { code: '23505' } })

      await expect(
        service.importCsv(
          Buffer.from(
            `${ASSET_CSV_COLUMNS.join(',')}\n${csvRow('RACE-1', 'Laptop')}`,
          ),
          'assets.csv',
          admin,
          testRequest,
        ),
      ).rejects.toBeInstanceOf(ConflictException)
      expect(manager.query.mock.calls.at(-1)?.[0]).toContain(
        'INSERT INTO public.assets',
      )
    })

    it('exports the same scoped and filtered dataset as the asset list', async () => {
      const { service, dataSource } = createService()
      dataSource.query.mockResolvedValueOnce([assetRow('AVAILABLE')])
      const requester: AuthenticatedUser = {
        ...admin,
        id: 'requester-id',
        roles: ['USER'],
        permissions: ['assets.read'],
      }

      const csv = await service.exportCsv(
        {
          categoryId: 'category-id',
          search: 'Laptop',
        } as never,
        requester,
      )

      expect(dataSource.query.mock.calls[0][0]).toContain(
        'own_assignment.user_id',
      )
      expect(dataSource.query.mock.calls[0][0]).toContain('a.category_id = $3')
      expect(dataSource.query.mock.calls[0][1]).toEqual([
        requester.id,
        '%Laptop%',
        'category-id',
      ])
      expect(csv).toContain('"IT-0001"')
      expect(csv).not.toContain('assigned_user')
    })
  })

  it('generates a signed-in asset lookup QR using the permanent asset code', async () => {
    const { service, dataSource } = createService()
    dataSource.query.mockResolvedValueOnce([assetRow('AVAILABLE')])

    const svg = await service.qr('asset-id', admin)
    const expected = await QRCode.toString(
      'http://localhost:5173/assets/by-code/AST-1',
      { type: 'svg', margin: 1, width: 240 },
    )

    expect(svg).toBe(expected)
  })

  it('whitelists asset sorting and returns the administrator assignee fields', async () => {
    const { service, dataSource } = createService()
    dataSource.query
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        { ...assetRow('ASSIGNED'), assigned_user_id: 'user-id' },
      ])

    const result = await service.list(
      {
        sort: 'assetTag',
        order: 'asc',
        page: 1,
        limit: 25,
      } as never,
      admin,
    )

    expect(dataSource.query.mock.calls[1][0]).toMatch(
      /ORDER BY a\.asset_tag\s+ASC/,
    )
    expect(result.items[0].assignedUser?.id).toBe('user-id')
  })

  it('rejects a direct transition to ASSIGNED and requires assignment workflow', async () => {
    const { service, manager } = createService()
    manager.query.mockResolvedValueOnce([
      {
        id: 'asset-id',
        asset_tag: 'IT-0001',
        name: 'Laptop',
        category_id: 'category-id',
        manufacturer: null,
        model: null,
        serial_number: null,
        description: null,
        status: 'AVAILABLE',
        condition: 'GOOD',
        purchase_date: null,
        purchase_cost: null,
        warranty_start: null,
        warranty_end: null,
        location_id: null,
        notes: null,
      },
    ])

    await expect(
      service.setStatus('asset-id', { status: 'ASSIGNED' }, admin, testRequest),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(manager.query).toHaveBeenCalledOnce()
  })

  it('rejects invalid lifecycle transitions without writing status history', async () => {
    const { service, manager } = createService()
    manager.query.mockResolvedValueOnce([
      {
        id: 'asset-id',
        asset_tag: 'IT-0001',
        name: 'Laptop',
        category_id: 'category-id',
        manufacturer: null,
        model: null,
        serial_number: null,
        description: null,
        status: 'DISPOSED',
        condition: 'GOOD',
        purchase_date: null,
        purchase_cost: null,
        warranty_start: null,
        warranty_end: null,
        location_id: null,
        notes: null,
      },
    ])

    await expect(
      service.setStatus(
        'asset-id',
        { status: 'AVAILABLE' },
        admin,
        testRequest,
      ),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(manager.query).toHaveBeenCalledOnce()
  })

  it('rejects assignment to an inactive user', async () => {
    const { service, manager } = createService()
    manager.query
      .mockResolvedValueOnce([
        {
          id: 'asset-id',
          asset_tag: 'IT-0001',
          name: 'Laptop',
          category_id: 'category-id',
          manufacturer: null,
          model: null,
          serial_number: null,
          description: null,
          status: 'AVAILABLE',
          condition: 'GOOD',
          purchase_date: null,
          purchase_cost: null,
          warranty_start: null,
          warranty_end: null,
          location_id: null,
          notes: null,
        },
      ])
      .mockResolvedValueOnce([])

    await expect(
      service.assign(
        'asset-id',
        { userId: 'disabled-user' },
        admin,
        testRequest,
      ),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(manager.query).toHaveBeenCalledTimes(2)
  })
})
