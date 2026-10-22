import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DataSource } from 'typeorm'
import { createDatabaseOptions } from '../src/database/database-options'
import {
  ISOLATED_TEST_DATABASE_NAME,
  requireIsolatedTestDatabaseUrl,
} from '../src/database/test-database-url'

const databaseUrl = requireIsolatedTestDatabaseUrl(
  process.env.TEST_DATABASE_URL,
)
const dataSource = new DataSource(createDatabaseOptions(databaseUrl))
const requiredTables = [
  'users',
  'assets',
  'asset_assignments',
  'tickets',
  'ticket_status_history',
  'audit_logs',
]

beforeAll(async () => {
  await dataSource.initialize()
})

afterAll(async () => {
  if (dataSource.isInitialized) {
    await dataSource.destroy()
  }
})

describe('isolated PostgreSQL schema smoke test', () => {
  it('connects only to the explicitly configured dedicated test database', async () => {
    const rows = (await dataSource.query(
      'SELECT current_database() AS database_name',
    )) as Array<{ database_name: string }>

    expect(rows[0]?.database_name).toBe(ISOLATED_TEST_DATABASE_NAME)
    expect(dataSource.options.synchronize).toBe(false)
    expect(dataSource.options.migrationsRun).toBe(false)
  })

  it('contains the existing domain tables needed by critical workflows', async () => {
    const rows = (await dataSource.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [requiredTables],
    )) as Array<{ table_name: string }>

    expect(rows.map((row) => row.table_name).sort()).toEqual(
      [...requiredTables].sort(),
    )
  })
})
