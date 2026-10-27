import { describe, expect, it, vi } from 'vitest'
import {
  INITIAL_SCHEMA_MIGRATION,
  INITIAL_SCHEMA_TABLES,
} from '../src/database/migration-preflight'
import {
  runMigrationsWithPreflight,
  type MigrationExecutor,
  type MigrationQueryRunner,
} from '../src/database/migration-runner'

const migrations = [
  { name: INITIAL_SCHEMA_MIGRATION, timestamp: 1792392190000 },
  {
    name: 'AddTicketLocationAndResolutionSummary1792392200000',
    timestamp: 1792392200000,
  },
  {
    name: 'CompleteTicketTypeAndSupportRole1792392210000',
    timestamp: 1792392210000,
  },
  {
    name: 'AddAssetCodesAndSharedAssets1792392220000',
    timestamp: 1792392220000,
  },
  {
    name: 'SeedCoreRolesAndPermissions1792392230000',
    timestamp: 1792392230000,
  },
  {
    name: 'CompleteCoreRoleAssetPermissions1792392240000',
    timestamp: 1792392240000,
  },
  {
    name: 'ExpandAssetTagLength1792392250000',
    timestamp: 1792392250000,
  },
]

function createRunner({
  publicTables,
  appliedNames = [],
  missingPrerequisites = [],
  missingViews = [],
}: {
  publicTables?: string[]
  appliedNames?: string[]
  missingPrerequisites?: string[]
  missingViews?: string[]
} = {}) {
  let transactionActive = false
  let pendingHistory: string[] = []
  const persistedHistory = [...appliedNames]
  const queryLog: string[] = []
  const query = vi.fn(async (sql: string, parameters?: unknown[]) => {
    queryLog.push(sql)
    if (sql.includes('to_regclass')) {
      return [
        {
          migration_table:
            persistedHistory.length > 0 || pendingHistory.length > 0
              ? 'typeorm_migrations'
              : null,
        },
      ]
    }
    if (sql.includes('SELECT name FROM public.typeorm_migrations')) {
      return [...persistedHistory, ...pendingHistory].map((name) => ({
        name,
      }))
    }
    if (sql.includes('ORDER BY table_name')) {
      const hasBaseline =
        persistedHistory.includes(INITIAL_SCHEMA_MIGRATION) ||
        pendingHistory.includes(INITIAL_SCHEMA_MIGRATION)
      return (publicTables ?? (hasBaseline ? INITIAL_SCHEMA_TABLES : [])).map(
        (table_name) => ({ table_name }),
      )
    }
    if (sql.includes('information_schema.views')) {
      const requestedViews = parameters?.[0] as string[]
      return requestedViews
        .filter((view) => !missingViews.includes(view))
        .map((table_name) => ({ table_name }))
    }
    if (sql.includes('ANY($1::text[])')) {
      const requestedTables = parameters?.[0] as string[]
      return requestedTables
        .filter((table) => !missingPrerequisites.includes(table))
        .map((table_name) => ({ table_name }))
    }
    if (sql.includes('pg_get_serial_sequence')) {
      return [
        {
          sequence: 'public.tickets_ticket_number_seq',
          is_identity: 'YES',
        },
      ]
    }
    if (sql.includes('INSERT INTO public.typeorm_migrations')) {
      pendingHistory.push(String(parameters?.[0] ?? INITIAL_SCHEMA_MIGRATION))
    }
    return []
  })

  const runner: MigrationQueryRunner = {
    get isTransactionActive() {
      return transactionActive
    },
    connect: vi.fn(async () => undefined),
    startTransaction: vi.fn(async () => {
      transactionActive = true
    }),
    commitTransaction: vi.fn(async () => {
      persistedHistory.push(...pendingHistory)
      pendingHistory = []
      transactionActive = false
    }),
    rollbackTransaction: vi.fn(async () => {
      pendingHistory = []
      transactionActive = false
    }),
    beforeMigration: vi.fn(async () => undefined),
    afterMigration: vi.fn(async () => undefined),
    release: vi.fn(async () => undefined),
    query,
  }

  return { runner, persistedHistory, queryLog }
}

function createExecutor(
  queryRunner: MigrationQueryRunner,
  pendingMigrations = migrations.slice(1),
): MigrationExecutor {
  return {
    transaction: 'all',
    getAllMigrations: vi.fn(async () => migrations),
    executeMigration: vi.fn(async (migration) => {
      await queryRunner.query('INSERT INTO public.typeorm_migrations', [
        migration.name,
      ])
      return migration
    }),
    executePendingMigrations: vi.fn(async () => pendingMigrations),
  }
}

describe('migration runner transaction', () => {
  it('runs the baseline before validating later migration prerequisites', async () => {
    const { runner, persistedHistory, queryLog } = createRunner()
    let executor: MigrationExecutor | undefined

    await expect(
      runMigrationsWithPreflight(
        { migrations, createQueryRunner: () => runner },
        (queryRunner) => {
          executor = createExecutor(queryRunner)
          return executor
        },
      ),
    ).resolves.toHaveLength(7)

    const baselineWriteIndex = queryLog.findIndex((sql) =>
      sql.includes('INSERT INTO public.typeorm_migrations'),
    )
    const prerequisiteCheckIndex = queryLog.findIndex((sql) =>
      sql.includes('ANY($1::text[])'),
    )
    expect(baselineWriteIndex).toBeGreaterThan(-1)
    expect(prerequisiteCheckIndex).toBeGreaterThan(baselineWriteIndex)
    expect(executor?.executeMigration).toHaveBeenCalledOnce()
    expect(executor?.executePendingMigrations).toHaveBeenCalledOnce()
    expect(persistedHistory).toEqual([INITIAL_SCHEMA_MIGRATION])
    expect(runner.commitTransaction).toHaveBeenCalledOnce()
    expect(runner.rollbackTransaction).not.toHaveBeenCalled()
  })

  it('rejects partial schemas before baseline execution and recording', async () => {
    const { runner, persistedHistory } = createRunner({
      publicTables: ['tickets'],
    })
    const createExecutorMock = vi.fn((queryRunner: MigrationQueryRunner) =>
      createExecutor(queryRunner),
    )

    await expect(
      runMigrationsWithPreflight(
        { migrations, createQueryRunner: () => runner },
        createExecutorMock,
      ),
    ).rejects.toThrow('partially populated or unrelated database')

    expect(createExecutorMock).not.toHaveBeenCalled()
    expect(runner.commitTransaction).not.toHaveBeenCalled()
    expect(runner.rollbackTransaction).toHaveBeenCalledOnce()
    expect(persistedHistory).toEqual([])
  })

  it('rejects missing prerequisites after the baseline and rolls back history', async () => {
    const { runner, persistedHistory } = createRunner({
      missingPrerequisites: ['tickets'],
    })
    let executor: MigrationExecutor | undefined

    await expect(
      runMigrationsWithPreflight(
        { migrations, createQueryRunner: () => runner },
        (queryRunner) => {
          executor = createExecutor(queryRunner)
          return executor
        },
      ),
    ).rejects.toThrow('prerequisite table(s) missing: tickets')

    expect(executor?.executeMigration).toHaveBeenCalledOnce()
    expect(executor?.executePendingMigrations).not.toHaveBeenCalled()
    expect(runner.rollbackTransaction).toHaveBeenCalledOnce()
    expect(persistedHistory).toEqual([])
  })

  it('validates later prerequisites when the baseline is already applied', async () => {
    const { runner } = createRunner({
      appliedNames: [INITIAL_SCHEMA_MIGRATION],
      missingPrerequisites: ['tickets'],
    })
    const createExecutorMock = vi.fn((queryRunner: MigrationQueryRunner) =>
      createExecutor(queryRunner),
    )

    await expect(
      runMigrationsWithPreflight(
        { migrations, createQueryRunner: () => runner },
        createExecutorMock,
      ),
    ).rejects.toThrow('prerequisite table(s) missing: tickets')

    expect(createExecutorMock).not.toHaveBeenCalled()
    expect(runner.rollbackTransaction).toHaveBeenCalledOnce()
  })

  it('rejects unexpected history without invoking the migration executor', async () => {
    const { runner } = createRunner({
      appliedNames: ['UnexpectedMigration'],
    })
    const createExecutorMock = vi.fn(() => createExecutor(runner))

    await expect(
      runMigrationsWithPreflight(
        { migrations, createQueryRunner: () => runner },
        createExecutorMock,
      ),
    ).rejects.toThrow('records missing from this checkout')

    expect(createExecutorMock).not.toHaveBeenCalled()
    expect(runner.rollbackTransaction).toHaveBeenCalledOnce()
  })

  it('does not execute or falsely record migrations for an inconsistent baseline', async () => {
    const { runner, persistedHistory } = createRunner({
      appliedNames: [INITIAL_SCHEMA_MIGRATION],
      publicTables: ['users'],
    })
    const createExecutorMock = vi.fn(() => createExecutor(runner))

    await expect(
      runMigrationsWithPreflight(
        { migrations, createQueryRunner: () => runner },
        createExecutorMock,
      ),
    ).rejects.toThrow('required table(s) are missing')

    expect(createExecutorMock).not.toHaveBeenCalled()
    expect(runner.commitTransaction).not.toHaveBeenCalled()
    expect(runner.rollbackTransaction).toHaveBeenCalledOnce()
    expect(persistedHistory).toEqual([INITIAL_SCHEMA_MIGRATION])
  })
})
