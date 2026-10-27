import {
  assertMigrationPreflight,
  assertMigrationHistory,
  type MigrationDescriptor,
} from './migration-preflight'

const MIGRATION_ADVISORY_LOCK_KEYS = [179239, 220000] as const

export interface MigrationQueryRunner {
  readonly isTransactionActive: boolean
  connect(): Promise<void>
  startTransaction(): Promise<void>
  commitTransaction(): Promise<void>
  rollbackTransaction(): Promise<void>
  beforeMigration(): Promise<void>
  afterMigration(): Promise<void>
  release(): Promise<void>
  query(
    sql: string,
    parameters?: unknown[],
  ): Promise<Array<Record<string, unknown>>>
}

export interface MigrationExecutor {
  transaction: 'all' | 'none' | 'each'
  getAllMigrations(): Promise<MigrationDescriptor[]>
  executeMigration(migration: MigrationDescriptor): Promise<MigrationDescriptor>
  executePendingMigrations(): Promise<MigrationDescriptor[]>
}

interface MigrationDataSource {
  migrations: MigrationDescriptor[]
  createQueryRunner(): MigrationQueryRunner
}

export async function runMigrationsWithPreflight(
  dataSource: MigrationDataSource,
  createMigrationExecutor: (
    queryRunner: MigrationQueryRunner,
  ) => MigrationExecutor,
): Promise<MigrationDescriptor[]> {
  const queryRunner = dataSource.createQueryRunner()
  let connected = false

  try {
    await queryRunner.connect()
    connected = true
    await queryRunner.startTransaction()
    await queryRunner.query('SELECT pg_advisory_xact_lock($1, $2)', [
      ...MIGRATION_ADVISORY_LOCK_KEYS,
    ])

    const [{ migration_table: migrationTable }] = await queryRunner.query(
      `SELECT to_regclass('public.typeorm_migrations') AS migration_table`,
    )
    const appliedMigrations: Array<Record<string, unknown>> = migrationTable
      ? await queryRunner.query(
          'SELECT name FROM public.typeorm_migrations ORDER BY id',
        )
      : []
    const appliedNames = appliedMigrations.map((migration) =>
      String(migration.name),
    )

    assertMigrationHistory(dataSource.migrations, appliedNames)
    await assertMigrationPreflight(
      dataSource.migrations,
      appliedNames,
      (sql, parameters) => queryRunner.query(sql, parameters),
    )

    const executor = createMigrationExecutor(queryRunner)
    executor.transaction = 'all'
    const executedMigrations: MigrationDescriptor[] = []

    if (!appliedNames.includes('InitialSchema1792392190000')) {
      const baselineMigration = (await executor.getAllMigrations()).find(
        (migration) => migration.name === 'InitialSchema1792392190000',
      )
      if (!baselineMigration) {
        throw new Error(
          'The initial schema migration was not discovered by TypeORM.',
        )
      }

      executedMigrations.push(
        await executor.executeMigration(baselineMigration),
      )

      const baselineHistory = await queryRunner.query(
        'SELECT name FROM public.typeorm_migrations ORDER BY id',
      )
      const baselineAppliedNames = baselineHistory.map((migration) =>
        String(migration.name),
      )
      assertMigrationHistory(dataSource.migrations, baselineAppliedNames)
      await assertMigrationPreflight(
        dataSource.migrations,
        baselineAppliedNames,
        (sql, parameters) => queryRunner.query(sql, parameters),
      )
    }

    executedMigrations.push(...(await executor.executePendingMigrations()))
    await queryRunner.commitTransaction()
    return executedMigrations
  } catch (error) {
    if (queryRunner.isTransactionActive) {
      try {
        await queryRunner.rollbackTransaction()
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          'Migration preflight or execution failed, and transaction rollback also failed.',
          { cause: rollbackError },
        )
      }
    }
    throw error
  } finally {
    if (connected) {
      await queryRunner.release()
    }
  }
}
