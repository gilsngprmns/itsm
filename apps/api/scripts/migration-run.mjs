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
    'Compiled TypeORM data source is missing. Build the API before running migrations.',
  )
}
const { MigrationExecutor } = require('typeorm')
const { runMigrationsWithPreflight } = require(
  resolve(scriptDirectory, '../dist/database/migration-runner.js'),
)
const dataSource = require(dataSourcePath).default

if (!dataSource) {
  throw new Error('Compiled TypeORM data source does not export a DataSource.')
}

await dataSource.initialize()

try {
  const migrations = await runMigrationsWithPreflight(
    dataSource,
    (queryRunner) => {
      return new MigrationExecutor(dataSource, queryRunner)
    },
  )
  console.log(`Successfully applied ${migrations.length} pending migration(s).`)
} finally {
  await dataSource.destroy()
}
