import { join } from 'node:path'
import type { DataSourceOptions } from 'typeorm'

const SSL_MODES_WITH_AMBIGUOUS_FUTURE_BEHAVIOR = new Set([
  'prefer',
  'require',
  'verify-ca',
])

export function createDatabaseOptions(
  databaseUrl: string,
  statementTimeoutMs = 3000,
): DataSourceOptions {
  const parsedUrl = new URL(databaseUrl)
  const sslMode = parsedUrl.searchParams.get('sslmode')?.toLowerCase()

  if (sslMode === 'no-verify') {
    throw new Error(
      'DATABASE_URL sslmode=no-verify is not allowed because it disables certificate verification',
    )
  }
  if (sslMode && SSL_MODES_WITH_AMBIGUOUS_FUTURE_BEHAVIOR.has(sslMode)) {
    parsedUrl.searchParams.set('sslmode', 'verify-full')
  }

  return {
    type: 'postgres',
    url: parsedUrl.toString(),
    synchronize: false,
    migrationsRun: false,
    migrationsTableName: 'typeorm_migrations',
    migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
    connectTimeoutMS: 5000,
    extra: {
      statement_timeout: statementTimeoutMs,
    },
  }
}
