import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ISOLATED_TEST_DATABASE_NAME,
  requireIsolatedTestDatabaseUrl,
} from '../src/database/test-database-url'

const safeUrl = `postgresql://127.0.0.1:5432/${ISOLATED_TEST_DATABASE_NAME}`

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isolated PostgreSQL test database configuration', () => {
  it('requires an explicit test-only URL', () => {
    expect(() => requireIsolatedTestDatabaseUrl(undefined)).toThrow(
      'TEST_DATABASE_URL must be explicitly configured',
    )
  })

  it('accepts the dedicated test database on loopback', () => {
    expect(requireIsolatedTestDatabaseUrl(safeUrl)).toBe(safeUrl)
  })

  it('rejects the development database even on loopback', () => {
    expect(() =>
      requireIsolatedTestDatabaseUrl('postgresql://127.0.0.1:5432/it_db'),
    ).toThrow('must target the dedicated local test database')
  })

  it('rejects another test database even when it is on loopback', () => {
    expect(() =>
      requireIsolatedTestDatabaseUrl(
        'postgresql://127.0.0.1:5432/another_test_database',
      ),
    ).toThrow('must target the dedicated local test database')
  })

  it('only accepts the CI service database in CI', () => {
    const ciUrl = 'postgresql://127.0.0.1:5432/itsm_ci_test'
    vi.stubEnv('CI', 'true')
    expect(requireIsolatedTestDatabaseUrl(ciUrl)).toBe(ciUrl)

    vi.stubEnv('CI', 'false')
    expect(() => requireIsolatedTestDatabaseUrl(ciUrl)).toThrow(
      'must target the dedicated local test database',
    )
  })

  it('rejects the dedicated database on a remote host', () => {
    expect(() =>
      requireIsolatedTestDatabaseUrl(
        `postgresql://db.example.com:5432/${ISOLATED_TEST_DATABASE_NAME}`,
      ),
    ).toThrow('must target a loopback database host')
  })

  it('rejects non-PostgreSQL schemes', () => {
    expect(() =>
      requireIsolatedTestDatabaseUrl(
        `https://localhost/${ISOLATED_TEST_DATABASE_NAME}`,
      ),
    ).toThrow('must use PostgreSQL')
  })

  it('rejects URL fragments', () => {
    expect(() => requireIsolatedTestDatabaseUrl(`${safeUrl}#it_db`)).toThrow(
      'must not contain a URL fragment',
    )
  })
})
