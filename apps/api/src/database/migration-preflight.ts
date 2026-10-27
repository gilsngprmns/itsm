export interface MigrationDescriptor {
  name: string
  timestamp: number
}

export type MigrationDatabaseQuery = (
  sql: string,
  parameters?: unknown[],
) => Promise<Array<Record<string, unknown>>>

export const INITIAL_SCHEMA_MIGRATION = 'InitialSchema1792392190000'

const REQUIRED_MIGRATION_NAMES = [
  INITIAL_SCHEMA_MIGRATION,
  'AddTicketLocationAndResolutionSummary1792392200000',
  'CompleteTicketTypeAndSupportRole1792392210000',
  'AddAssetCodesAndSharedAssets1792392220000',
  'SeedCoreRolesAndPermissions1792392230000',
  'CompleteCoreRoleAssetPermissions1792392240000',
  'ExpandAssetTagLength1792392250000',
]

const MIGRATION_PREREQUISITES: Record<string, string[]> = {
  AddTicketLocationAndResolutionSummary1792392200000: ['tickets', 'locations'],
  CompleteTicketTypeAndSupportRole1792392210000: [
    'tickets',
    'users',
    'roles',
    'permissions',
    'role_permissions',
  ],
  AddAssetCodesAndSharedAssets1792392220000: [
    'assets',
    'roles',
    'permissions',
    'role_permissions',
  ],
  ExpandAssetTagLength1792392250000: ['assets'],
}

const MIGRATION_VIEW_PREREQUISITES: Record<string, string[]> = {
  ExpandAssetTagLength1792392250000: ['v_asset_inventory', 'v_ticket_overview'],
}

export const INITIAL_SCHEMA_TABLES = [
  'app_settings',
  'asset_assignments',
  'asset_categories',
  'asset_maintenance',
  'asset_status_history',
  'assets',
  'audit_logs',
  'departments',
  'inventory_audit_items',
  'inventory_audits',
  'locations',
  'notifications',
  'permissions',
  'refresh_tokens',
  'role_permissions',
  'roles',
  'ticket_assignments',
  'ticket_attachments',
  'ticket_categories',
  'ticket_comments',
  'ticket_sla_policies',
  'ticket_status_history',
  'tickets',
  'user_roles',
  'users',
  'vendors',
]

export function assertMigrationHistory(
  migrations: MigrationDescriptor[],
  appliedMigrationNames: string[],
): Set<string> {
  const sortedMigrations = [...migrations].sort(
    (left, right) => left.timestamp - right.timestamp,
  )
  const migrationNames = new Set<string>()
  const migrationTimestamps = new Set<number>()

  for (const migration of sortedMigrations) {
    if (!Number.isSafeInteger(migration.timestamp) || migration.timestamp < 1) {
      throw new Error(
        'Migration sources contain an invalid migration timestamp.',
      )
    }
    if (
      migrationNames.has(migration.name) ||
      migrationTimestamps.has(migration.timestamp)
    ) {
      throw new Error(
        'Migration sources contain duplicate names or timestamps.',
      )
    }
    migrationNames.add(migration.name)
    migrationTimestamps.add(migration.timestamp)
  }

  const missingRequiredSources = REQUIRED_MIGRATION_NAMES.filter(
    (name) => !migrationNames.has(name),
  )
  if (missingRequiredSources.length > 0) {
    throw new Error(
      `Required migration source(s) are missing from this checkout: ${missingRequiredSources.join(', ')}.`,
    )
  }

  const appliedNames = new Set(appliedMigrationNames)
  if (appliedNames.size !== appliedMigrationNames.length) {
    throw new Error('Migration history contains duplicate migration records.')
  }

  const unknownMigrations = [...appliedNames].filter(
    (name) => !migrationNames.has(name),
  )
  if (unknownMigrations.length > 0) {
    throw new Error(
      `Migration history contains records missing from this checkout: ${unknownMigrations.join(', ')}.`,
    )
  }

  const baselineIndex = sortedMigrations.findIndex(
    (migration) => migration.name === INITIAL_SCHEMA_MIGRATION,
  )
  if (baselineIndex < 0) {
    throw new Error(
      'The required initial schema migration source is missing from this checkout.',
    )
  }

  const latestAppliedIndex = sortedMigrations.reduce(
    (latestIndex, migration, index) =>
      appliedNames.has(migration.name)
        ? Math.max(latestIndex, index)
        : latestIndex,
    -1,
  )
  if (
    latestAppliedIndex >= baselineIndex &&
    !appliedNames.has(INITIAL_SCHEMA_MIGRATION)
  ) {
    throw new Error(
      'Migration history is inconsistent: a later migration is recorded without the initial schema migration.',
    )
  }

  for (let index = 0; index <= latestAppliedIndex; index += 1) {
    if (!appliedNames.has(sortedMigrations[index].name)) {
      throw new Error(
        `Migration history is inconsistent: ${sortedMigrations[index].name} is missing before a later applied migration.`,
      )
    }
  }

  return appliedNames
}

export async function assertMigrationPreflight(
  migrations: MigrationDescriptor[],
  appliedMigrationNames: string[],
  query: MigrationDatabaseQuery,
): Promise<void> {
  const appliedNames = assertMigrationHistory(migrations, appliedMigrationNames)
  const baselineApplied = appliedNames.has(INITIAL_SCHEMA_MIGRATION)
  const existingTables = await readPublicBaseTables(query)

  if (!baselineApplied) {
    assertPendingBaselineCanRun(existingTables)
    return
  }

  const existingTableSet = new Set(existingTables)
  const missingBaselineTables = INITIAL_SCHEMA_TABLES.filter(
    (table) => !existingTableSet.has(table),
  )
  if (missingBaselineTables.length > 0) {
    throw new Error(
      `Migration history says the initial schema is applied, but required table(s) are missing: ${missingBaselineTables.join(', ')}.`,
    )
  }

  const pendingMigrations = migrations
    .filter((migration) => !appliedNames.has(migration.name))
    .sort((left, right) => left.timestamp - right.timestamp)

  for (const migration of pendingMigrations) {
    await assertMigrationPrerequisites(migration.name, query)
  }
}

async function readPublicBaseTables(
  query: MigrationDatabaseQuery,
): Promise<string[]> {
  const rows = await query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       AND table_name <> 'typeorm_migrations'
     ORDER BY table_name`,
  )
  return rows.map((row) => String(row.table_name))
}

function assertPendingBaselineCanRun(existingTables: string[]): void {
  if (existingTables.length === 0) {
    return
  }

  const existingTableSet = new Set(existingTables)
  const missingTables = INITIAL_SCHEMA_TABLES.filter(
    (table) => !existingTableSet.has(table),
  )
  const unexpectedTables = existingTables.filter(
    (table) => !INITIAL_SCHEMA_TABLES.includes(table),
  )
  if (missingTables.length > 0 || unexpectedTables.length > 0) {
    const details = [
      missingTables.length > 0 &&
        `missing baseline table(s): ${missingTables.join(', ')}`,
      unexpectedTables.length > 0 &&
        `unexpected public table(s): ${unexpectedTables.join(', ')}`,
    ]
      .filter(Boolean)
      .join('; ')
    throw new Error(
      `Refusing to apply the initial schema migration to a partially populated or unrelated database (${details}).`,
    )
  }
}

async function assertMigrationPrerequisites(
  migrationName: string,
  query: MigrationDatabaseQuery,
): Promise<void> {
  const requiredTables = MIGRATION_PREREQUISITES[migrationName]
  if (!requiredTables) {
    return
  }

  const rows = await query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       AND table_name = ANY($1::text[])`,
    [requiredTables],
  )
  const existingTables = new Set(rows.map((row) => String(row.table_name)))
  const missingTables = requiredTables.filter(
    (table) => !existingTables.has(table),
  )

  if (missingTables.length > 0) {
    throw new Error(
      `Refusing to run ${migrationName}: prerequisite table(s) missing: ${missingTables.join(', ')}.`,
    )
  }

  if (migrationName === 'AddTicketLocationAndResolutionSummary1792392200000') {
    const [ticketNumber] = await query(
      `SELECT pg_get_serial_sequence('public.tickets', 'ticket_number') AS sequence,
              (SELECT is_identity FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'tickets'
                 AND column_name = 'ticket_number') AS is_identity`,
    )

    if (
      ticketNumber.sequence !== 'public.tickets_ticket_number_seq' ||
      ticketNumber.is_identity !== 'YES'
    ) {
      throw new Error(
        `Refusing to run ${migrationName}: public.tickets.ticket_number must use the expected identity sequence.`,
      )
    }
  }

  const requiredViews = MIGRATION_VIEW_PREREQUISITES[migrationName]
  if (requiredViews) {
    const viewRows = await query(
      `SELECT table_name
       FROM information_schema.views
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [requiredViews],
    )
    const existingViews = new Set(viewRows.map((row) => String(row.table_name)))
    const missingViews = requiredViews.filter(
      (view) => !existingViews.has(view),
    )
    if (missingViews.length > 0) {
      throw new Error(
        `Refusing to run ${migrationName}: prerequisite view(s) missing: ${missingViews.join(', ')}.`,
      )
    }
  }
}
