import { ConflictException } from '@nestjs/common'
import type { Request } from 'express'
import { DataSource, type EntityManager } from 'typeorm'
import { describe, expect, it, vi } from 'vitest'
import { AssetsService } from '../src/modules/assets/assets.service'
import type { AuthenticatedUser } from '../src/modules/auth/auth.types'

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
    query: vi.fn(),
    transaction: vi.fn(
      async (callback: (manager: EntityManager) => Promise<unknown>) =>
        callback(manager as unknown as EntityManager),
    ),
  }
  return {
    manager,
    dataSource,
    service: new AssetsService(dataSource as unknown as DataSource),
  }
}

function assetRow(status: string) {
  return {
    id: 'asset-id',
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
    expect(dataSource.query.mock.calls[0][1]).toContain(user.id)
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
