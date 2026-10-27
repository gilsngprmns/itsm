import { ConflictException } from '@nestjs/common'
import * as argon2 from 'argon2'
import type { Request } from 'express'
import { DataSource, type EntityManager } from 'typeorm'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { UsersService } from '../src/modules/users/users.service'

let request: Request

beforeAll(() => {
  request = {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'users-service-test' },
  } as Request
})

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
    service: new UsersService(dataSource as unknown as DataSource),
  }
}

const storedUser = {
  id: 'new-user',
  employee_code: 'EMP-1',
  full_name: 'New User',
  email: 'new@example.test',
  phone: null,
  is_active: true,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
  roles: ['USER'],
}

describe('UsersService', () => {
  it('returns only display fields from the read-only directory', async () => {
    const { service, dataSource } = createService()
    dataSource.query
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ id: 'active-user', full_name: 'Active User' }])

    const result = await service.directory({
      page: 1,
      limit: 25,
      search: 'Active',
    })

    expect(result.items).toEqual([
      { id: 'active-user', fullName: 'Active User' },
    ])
    expect(dataSource.query.mock.calls[1][0]).not.toMatch(/email|role|phone/i)
  })

  it('creates the user with a password hash and never returns the password or hash', async () => {
    const { service, manager, dataSource } = createService()
    manager.query
      .mockResolvedValueOnce([{ id: storedUser.id }])
      .mockResolvedValueOnce([{ id: 'user-role-id' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    dataSource.query.mockResolvedValueOnce([storedUser])

    const result = await service.create(
      {
        fullName: ' New User ',
        email: 'NEW@example.test',
        initialPassword: 'temporary-password-value',
      },
      'admin-id',
      request,
    )

    const insertedValues = manager.query.mock.calls[0][1] as unknown[]
    expect(insertedValues[2]).not.toBe('temporary-password-value')
    await expect(
      argon2.verify(String(insertedValues[2]), 'temporary-password-value'),
    ).resolves.toBe(true)
    expect(result).toEqual({
      id: storedUser.id,
      employeeCode: storedUser.employee_code,
      fullName: storedUser.full_name,
      isActive: true,
      createdAt: storedUser.created_at,
      updatedAt: storedUser.updated_at,
      roles: ['USER'],
      email: storedUser.email,
      phone: null,
    })
    expect(JSON.stringify(result)).not.toContain('password')
    expect(manager.query.mock.calls[2][0]).toContain(
      'INSERT INTO public.user_roles',
    )
  })

  it('turns database email and employee-code uniqueness failures into a conflict', async () => {
    const { service, manager } = createService()
    manager.query.mockRejectedValueOnce({
      driverError: { code: '23505' },
    })

    await expect(
      service.create(
        {
          fullName: 'Duplicate User',
          email: 'duplicate@example.test',
          initialPassword: 'temporary-password-value',
        },
        'admin-id',
        request,
      ),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('redacts personal data from read-only user views', async () => {
    const { service, dataSource } = createService()
    dataSource.query.mockResolvedValueOnce([storedUser])

    const result = await service.get(storedUser.id, false)

    expect(result).not.toHaveProperty('email')
    expect(result).not.toHaveProperty('phone')
    expect(result).not.toHaveProperty('passwordHash')
  })

  it('revokes every active session when an account is deactivated', async () => {
    const { service, manager, dataSource } = createService()
    manager.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          full_name: storedUser.full_name,
          email: storedUser.email,
          employee_code: storedUser.employee_code,
          phone: null,
          is_active: true,
        },
      ])
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    dataSource.query.mockResolvedValueOnce([
      { ...storedUser, is_active: false },
    ])

    const result = await service.setStatus(
      storedUser.id,
      { isActive: false },
      'admin-id',
      request,
    )

    expect(manager.query.mock.calls[4][0]).toContain(
      'UPDATE public.users SET is_active',
    )
    expect(manager.query.mock.calls[5][0]).toContain(
      'UPDATE public.refresh_tokens',
    )
    expect(manager.query.mock.calls[5][1]).toEqual([storedUser.id])
    expect(result.isActive).toBe(false)
  })

  it('does not allow an administrator to change their own role', async () => {
    const { service, dataSource } = createService()

    await expect(
      service.setRole('admin-id', { roleCode: 'USER' }, 'admin-id', request),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(dataSource.transaction).not.toHaveBeenCalled()
  })
})
