import { describe, expect, it, vi } from 'vitest'
import {
  assertMigrationHistory,
  assertMigrationPreflight,
  INITIAL_SCHEMA_MIGRATION,
  INITIAL_SCHEMA_TABLES,
  type MigrationDatabaseQuery,
  type MigrationDescriptor,
} from '../src/database/migration-preflight'

const migrations: MigrationDescriptor[] = [
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

function tableQuery(
  tables: string[],
  missingViews: string[] = [],
): MigrationDatabaseQuery {
  return vi.fn(async (sql: string, parameters?: unknown[]) => {
    if (sql.includes('ORDER BY table_name')) {
      return tables.map((table_name) => ({ table_name }))
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
        .filter((table) => tables.includes(table))
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

    return []
  })
}

describe('migration history validation', () => {
  it('rejects a checkout missing one of the project migration sources', () => {
    expect(() => assertMigrationHistory(migrations.slice(0, 3), [])).toThrow(
      'AddAssetCodesAndSharedAssets1792392220000',
    )
  })

  it('rejects unknown history records', () => {
    expect(() =>
      assertMigrationHistory(migrations, ['UnexpectedMigration']),
    ).toThrow('records missing from this checkout: UnexpectedMigration')
  })

  it('rejects later applied migrations when baseline is missing', () => {
    expect(() =>
      assertMigrationHistory(migrations, [
        'AddTicketLocationAndResolutionSummary1792392200000',
      ]),
    ).toThrow('later migration is recorded without the initial schema')
  })

  it('rejects an applied history with a missing earlier migration', () => {
    expect(() =>
      assertMigrationHistory(migrations, [
        INITIAL_SCHEMA_MIGRATION,
        'CompleteTicketTypeAndSupportRole1792392210000',
      ]),
    ).toThrow(
      'AddTicketLocationAndResolutionSummary1792392200000 is missing before a later applied migration',
    )
  })
})

describe('migration preflight', () => {
  it('allows a fresh empty database to run the baseline first', async () => {
    const query = tableQuery([])

    await expect(
      assertMigrationPreflight(migrations, [], query),
    ).resolves.toBeUndefined()
    expect(query).toHaveBeenCalledOnce()
  })

  it('does not check later migration prerequisites before the baseline runs', async () => {
    const query = tableQuery(INITIAL_SCHEMA_TABLES)

    await expect(
      assertMigrationPreflight(migrations, [], query),
    ).resolves.toBeUndefined()
    expect(query).toHaveBeenCalledOnce()
  })

  it('rejects partial baseline schemas before any migration can run', async () => {
    const query = tableQuery(['tickets', 'locations'])

    await expect(
      assertMigrationPreflight(migrations, [], query),
    ).rejects.toThrow('partially populated or unrelated database')
  })

  it('rejects unrelated tables in a database pending the baseline', async () => {
    const query = tableQuery(['legacy_table'])

    await expect(
      assertMigrationPreflight(migrations, [], query),
    ).rejects.toThrow('unexpected public table(s): legacy_table')
  })

  it('enforces ticket prerequisites after the baseline is applied', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce(
        INITIAL_SCHEMA_TABLES.map((table_name) => ({ table_name })),
      )
      .mockResolvedValueOnce([{ table_name: 'locations' }])

    await expect(
      assertMigrationPreflight(migrations, [INITIAL_SCHEMA_MIGRATION], query),
    ).rejects.toThrow('prerequisite table(s) missing: tickets')
  })

  it('accepts a fully migrated schema without migration-side writes', async () => {
    const query = tableQuery(INITIAL_SCHEMA_TABLES)

    await expect(
      assertMigrationPreflight(
        migrations,
        migrations.map((migration) => migration.name),
        query,
      ),
    ).resolves.toBeUndefined()
    expect(query).toHaveBeenCalledOnce()
  })

  it('rejects a baseline history whose schema is incomplete', async () => {
    const query = tableQuery(
      INITIAL_SCHEMA_TABLES.filter((table) => table !== 'tickets'),
    )

    await expect(
      assertMigrationPreflight(migrations, [INITIAL_SCHEMA_MIGRATION], query),
    ).rejects.toThrow('required table(s) are missing: tickets')
  })

  it('rejects migration 225 when either recreated view is absent', async () => {
    const appliedNames = migrations
      .slice(0, -1)
      .map((migration) => migration.name)
    const query = tableQuery(INITIAL_SCHEMA_TABLES, ['v_ticket_overview'])

    await expect(
      assertMigrationPreflight(migrations, appliedNames, query),
    ).rejects.toThrow('prerequisite view(s) missing: v_ticket_overview')
  })
})
