import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const scriptDirectory = resolve(fileURLToPath(new URL('.', import.meta.url)))
const dataSourcePath = resolve(
  scriptDirectory,
  '../dist/database/data-source.js',
)

if (!existsSync(dataSourcePath)) {
  throw new Error(
    'Compiled TypeORM data source is missing. Build the API before checking migration history.',
  )
}

const dataSourceModule = require(dataSourcePath)
const dataSource = dataSourceModule.default
const { assertMigrationHistory } = require(
  resolve(scriptDirectory, '../dist/database/migration-preflight.js'),
)

if (!dataSource) {
  throw new Error('Compiled TypeORM data source does not export a DataSource.')
}

await dataSource.initialize()

try {
  const [{ migration_table: migrationTable }] = await dataSource.query(
    `SELECT to_regclass('public.typeorm_migrations') AS migration_table`,
  )
  const appliedMigrations = migrationTable
    ? await dataSource.query(
        'SELECT name FROM public.typeorm_migrations ORDER BY id',
      )
    : []
  const appliedNames = appliedMigrations.map((migration) => migration.name)

  assertMigrationHistory(dataSource.migrations, appliedNames)

  const appliedSet = new Set(appliedNames)
  for (const migration of dataSource.migrations) {
    const name = migration.name || migration.constructor.name
    console.log(`[${appliedSet.has(name) ? 'X' : ' '}] ${name}`)
  }
  console.log(
    `Verified ${appliedNames.length} applied migration records against ${dataSource.migrations.length} available migration sources.`,
  )
} finally {
  await dataSource.destroy()
}
