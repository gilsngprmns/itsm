import { join } from 'node:path'
import type { DataSourceOptions } from 'typeorm'

export function createDatabaseOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    synchronize: false,
    migrationsRun: false,
    migrationsTableName: 'typeorm_migrations',
    migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
    connectTimeoutMS: 5000,
    extra: {
      statement_timeout: 3000,
    },
  }
}
