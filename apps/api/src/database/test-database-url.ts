export const ISOLATED_TEST_DATABASE_NAME = 'it_db_phase09_test'

const ALLOWED_TEST_DATABASE_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
])

export function requireIsolatedTestDatabaseUrl(
  value: string | undefined,
): string {
  if (!value?.trim()) {
    throw new Error('TEST_DATABASE_URL must be explicitly configured')
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL')
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('TEST_DATABASE_URL must use PostgreSQL')
  }
  if (url.hash) {
    throw new Error('TEST_DATABASE_URL must not contain a URL fragment')
  }

  if (!ALLOWED_TEST_DATABASE_HOSTS.has(url.hostname)) {
    throw new Error('TEST_DATABASE_URL must target a loopback database host')
  }

  let databaseName: string
  try {
    databaseName = decodeURIComponent(url.pathname.slice(1)).toLowerCase()
  } catch {
    throw new Error('TEST_DATABASE_URL contains invalid URL encoding')
  }

  if (databaseName !== ISOLATED_TEST_DATABASE_NAME) {
    throw new Error(
      `TEST_DATABASE_URL must target the dedicated ${ISOLATED_TEST_DATABASE_NAME} database`,
    )
  }

  return value
}
