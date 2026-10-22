import { config } from 'dotenv'
import pg from 'pg'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const { Pool } = pg
const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const envResult = config({
  path: resolve(scriptDirectory, '../../../.env'),
})

if (envResult.error || !process.env.DATABASE_URL) {
  console.error('Unable to load DATABASE_URL from the repository root .env.')
  process.exit(1)
}

const databaseUrl = new URL(process.env.DATABASE_URL)
if (decodeURIComponent(databaseUrl.pathname.slice(1)) !== 'it_db') {
  console.error(
    'Migration status is restricted to the configured it_db database.',
  )
  process.exit(1)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  max: 1,
})

async function showMigrationStatus() {
  const { rows } = await pool.query(
    `SELECT to_regclass('public.typeorm_migrations') AS migration_table`,
  )

  if (!rows[0].migration_table) {
    console.log(
      'No TypeORM migration history table exists; no migration status is recorded.',
    )
    return
  }

  const migrations = await pool.query(
    'SELECT id, timestamp, name FROM public.typeorm_migrations ORDER BY id',
  )

  if (migrations.rowCount === 0) {
    console.log(
      'TypeORM migration history table exists but contains no applied migrations.',
    )
    return
  }

  for (const migration of migrations.rows) {
    console.log(`${migration.id}\t${migration.timestamp}\t${migration.name}`)
  }
}

showMigrationStatus()
  .catch((error) => {
    console.error(
      `Unable to read migration status (code: ${error.code || 'unknown'}).`,
    )
    process.exitCode = 1
  })
  .finally(() => pool.end())
