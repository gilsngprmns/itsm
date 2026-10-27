import { Logger, ServiceUnavailableException } from '@nestjs/common'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DataSource } from 'typeorm'
import { createDatabaseOptions } from '../src/database/database-options'
import { DatabaseService } from '../src/database/database.service'
import { HealthController } from '../src/health/health.controller'

function createDataSource(): DataSource {
  return new DataSource(
    createDatabaseOptions(
      'postgresql://postgres:placeholder@127.0.0.1:5432/it_db',
    ),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DatabaseService', () => {
  it('initializes TypeORM and runs a lightweight readiness query', async () => {
    const dataSource = createDataSource()
    const initialize = vi
      .spyOn(dataSource, 'initialize')
      .mockResolvedValue(dataSource)
    const query = vi
      .spyOn(dataSource, 'query')
      .mockResolvedValue([{ '?column?': 1 }])
    const service = new DatabaseService(dataSource)

    await expect(service.checkConnection()).resolves.toBe(true)
    expect(initialize).toHaveBeenCalledOnce()
    expect(query).toHaveBeenCalledWith('SELECT 1')
  })

  it('returns unavailable and logs only the database error code', async () => {
    const dataSource = createDataSource()
    vi.spyOn(dataSource, 'initialize').mockResolvedValue(dataSource)
    vi.spyOn(dataSource, 'query').mockRejectedValue(
      Object.assign(new Error('password=private-value'), { code: '28P01' }),
    )
    const warning = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined)
    const service = new DatabaseService(dataSource)

    await expect(service.checkConnection()).resolves.toBe(false)
    expect(warning).toHaveBeenCalledWith(
      'PostgreSQL readiness check failed (code: 28P01)',
    )
    expect(JSON.stringify(warning.mock.calls)).not.toContain('private-value')
  })

  it('does not enable schema synchronization or automatic migrations', () => {
    const options = createDatabaseOptions(
      'postgresql://postgres:placeholder@127.0.0.1:5432/it_db',
    )

    expect(options.synchronize).toBe(false)
    expect(options.migrationsRun).toBe(false)
    expect(options.migrationsTableName).toBe('typeorm_migrations')
    expect(options.extra).toMatchObject({ statement_timeout: 3000 })
  })

  it('supports a bounded migration-specific statement timeout', () => {
    const options = createDatabaseOptions(
      'postgresql://test-user:test-password@127.0.0.1:5432/it_db',
      30_000,
    )

    expect(options.extra).toMatchObject({ statement_timeout: 30_000 })
  })

  it('uses explicit full TLS verification for ambiguous PostgreSQL ssl modes', () => {
    const options = createDatabaseOptions(
      'postgresql://test-user:test-password@db.example.test/itsm?sslmode=require&channel_binding=require',
    )

    const normalizedUrl = new URL('url' in options ? (options.url ?? '') : '')
    expect(normalizedUrl.searchParams.get('sslmode')).toBe('verify-full')
    expect(normalizedUrl.searchParams.get('channel_binding')).toBe('require')
    expect(normalizedUrl.username).toBe('test-user')
    expect(normalizedUrl.password).toBe('test-password')
  })

  it('rejects PostgreSQL ssl mode that disables certificate verification', () => {
    expect(() =>
      createDatabaseOptions(
        'postgresql://test-user:test-password@db.example.test/itsm?sslmode=no-verify',
      ),
    ).toThrow('sslmode=no-verify is not allowed')
  })
})

describe('HealthController readiness', () => {
  it('returns an available response after the database query succeeds', async () => {
    const dataSource = createDataSource()
    vi.spyOn(dataSource, 'initialize').mockResolvedValue(dataSource)
    vi.spyOn(dataSource, 'query').mockResolvedValue([{ '?column?': 1 }])
    const controller = new HealthController(new DatabaseService(dataSource))

    await expect(controller.readiness()).resolves.toMatchObject({
      status: 'ok',
      service: 'api',
      database: 'available',
    })
  })

  it('returns a generic 503 response when the database query fails', async () => {
    const dataSource = createDataSource()
    vi.spyOn(dataSource, 'initialize').mockResolvedValue(dataSource)
    vi.spyOn(dataSource, 'query').mockRejectedValue(
      Object.assign(new Error('sensitive connection details'), {
        code: 'ECONNREFUSED',
      }),
    )
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const controller = new HealthController(new DatabaseService(dataSource))

    const failure = controller.readiness()
    await expect(failure).rejects.toBeInstanceOf(ServiceUnavailableException)
    await expect(failure).rejects.toMatchObject({
      response: {
        status: 'error',
        service: 'api',
        database: 'unavailable',
      },
    })
  })
})
