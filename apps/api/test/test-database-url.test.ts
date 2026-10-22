import { describe, expect, it } from 'vitest'
import {
  ISOLATED_TEST_DATABASE_NAME,
  requireIsolatedTestDatabaseUrl,
} from '../src/database/test-database-url'

const safeUrl = `postgresql://test:test@127.0.0.1:5432/${ISOLATED_TEST_DATABASE_NAME}`

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
      requireIsolatedTestDatabaseUrl(
        'postgresql://test:test@127.0.0.1:5432/it_db',
      ),
    ).toThrow(`must target the dedicated ${ISOLATED_TEST_DATABASE_NAME}`)
  })

  it('rejects an identically named database on a remote host', () => {
    expect(() =>
      requireIsolatedTestDatabaseUrl(
        `postgresql://test:test@db.example.com:5432/${ISOLATED_TEST_DATABASE_NAME}`,
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
