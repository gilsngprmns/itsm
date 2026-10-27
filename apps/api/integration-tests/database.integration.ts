import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { Request } from 'express'
import { DataSource, type MigrationInterface, type QueryRunner } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import { createDatabaseOptions } from '../src/database/database-options'
import { requireIsolatedTestDatabaseUrl } from '../src/database/test-database-url'
import type { AuthenticatedUser } from '../src/modules/auth/auth.types'
import { AssetsService } from '../src/modules/assets/assets.service'
import type { CreateAssetDto } from '../src/modules/assets/dto/create-asset.dto'
import { ExpandAssetTagLength1792392250000 } from '../src/database/migrations/1792392250000-ExpandAssetTagLength'
import { ReportsService } from '../src/modules/reports/reports.service'
import type { CreateTicketDto } from '../src/modules/tickets/dto/create-ticket.dto'
import { TicketsService } from '../src/modules/tickets/tickets.service'

const databaseUrl = requireIsolatedTestDatabaseUrl(
  process.env.TEST_DATABASE_URL,
)
const dataSource = new DataSource(createDatabaseOptions(databaseUrl))
const expectedDatabaseName = decodeURIComponent(
  new URL(databaseUrl).pathname.slice(1),
)
const requiredTables = [
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
  'ticket_type_history',
  'tickets',
  'user_roles',
  'users',
  'vendors',
]

beforeAll(async () => {
  await dataSource.initialize()

  const rows = (await dataSource.query(
    'SELECT current_database() AS database_name',
  )) as Array<{ database_name: string }>

  if (rows[0]?.database_name !== expectedDatabaseName) {
    throw new Error('Integration tests connected to an unexpected database')
  }

  await dataSource.runMigrations({ transaction: 'all' })
})

afterAll(async () => {
  if (dataSource.isInitialized) {
    await dataSource.destroy()
  }
})

describe('isolated PostgreSQL schema smoke test', () => {
  it('applies the full migration history to the dedicated test database', async () => {
    const rows = (await dataSource.query(
      'SELECT name FROM public.typeorm_migrations ORDER BY timestamp',
    )) as Array<{ name: string }>

    expect(rows.map((row) => row.name)).toEqual([
      'InitialSchema1792392190000',
      'AddTicketLocationAndResolutionSummary1792392200000',
      'CompleteTicketTypeAndSupportRole1792392210000',
      'AddAssetCodesAndSharedAssets1792392220000',
      'SeedCoreRolesAndPermissions1792392230000',
      'CompleteCoreRoleAssetPermissions1792392240000',
      'ExpandAssetTagLength1792392250000',
    ])
    expect(dataSource.options.synchronize).toBe(false)
    expect(dataSource.options.migrationsRun).toBe(false)
  })

  it('contains the existing domain tables needed by critical workflows', async () => {
    const rows = (await dataSource.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [requiredTables],
    )) as Array<{ table_name: string }>

    expect(rows.map((row) => row.table_name).sort()).toEqual(
      [...requiredTables].sort(),
    )
  })

  it('seeds the application roles and their base permissions', async () => {
    const roles = (await dataSource.query(
      'SELECT code FROM public.roles ORDER BY code',
    )) as Array<{ code: string }>
    expect(roles.map((row) => row.code)).toEqual([
      'ADMIN',
      'AUDIT',
      'IT_SUPPORT',
      'USER',
    ])

    const mappings = (await dataSource.query(
      `SELECT r.code AS role_code, p.code AS permission_code
       FROM public.role_permissions rp
       JOIN public.roles r ON r.id = rp.role_id
       JOIN public.permissions p ON p.id = rp.permission_id
       WHERE (r.code, p.code) IN (
         ('ADMIN', 'users.read'),
         ('ADMIN', 'tickets.assign'),
         ('ADMIN', 'assets.read.all'),
         ('ADMIN', 'assets.share'),
         ('AUDIT', 'audit.read'),
         ('AUDIT', 'reports.read'),
         ('AUDIT', 'assets.read.all'),
         ('IT_SUPPORT', 'tickets.self_assign'),
         ('USER', 'tickets.create'),
         ('USER', 'tickets.read.own')
       )
       ORDER BY r.code, p.code`,
    )) as Array<{ role_code: string; permission_code: string }>
    expect(mappings).toEqual([
      { role_code: 'ADMIN', permission_code: 'assets.read.all' },
      { role_code: 'ADMIN', permission_code: 'assets.share' },
      { role_code: 'ADMIN', permission_code: 'tickets.assign' },
      { role_code: 'ADMIN', permission_code: 'users.read' },
      { role_code: 'AUDIT', permission_code: 'assets.read.all' },
      { role_code: 'AUDIT', permission_code: 'audit.read' },
      { role_code: 'AUDIT', permission_code: 'reports.read' },
      { role_code: 'IT_SUPPORT', permission_code: 'tickets.self_assign' },
      { role_code: 'USER', permission_code: 'tickets.create' },
      { role_code: 'USER', permission_code: 'tickets.read.own' },
    ])
  })

  it('stores expected constraints and migration-added asset and ticket columns', async () => {
    const columns = (await dataSource.query(
      `SELECT table_name, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (table_name, column_name) IN (
           ('assets', 'asset_code'),
           ('assets', 'is_shared'),
           ('tickets', 'ticket_number'),
           ('tickets', 'location_id'),
           ('tickets', 'resolution_summary'),
           ('tickets', 'type')
         )
       ORDER BY table_name, column_name`,
    )) as Array<{
      table_name: string
      column_name: string
      data_type: string
      is_nullable: 'YES' | 'NO'
      column_default: string | null
    }>
    expect(
      columns.map(({ table_name, column_name, data_type, is_nullable }) => ({
        table_name,
        column_name,
        data_type,
        is_nullable,
      })),
    ).toEqual([
      {
        table_name: 'assets',
        column_name: 'asset_code',
        data_type: 'character varying',
        is_nullable: 'NO',
      },
      {
        table_name: 'assets',
        column_name: 'is_shared',
        data_type: 'boolean',
        is_nullable: 'NO',
      },
      {
        table_name: 'tickets',
        column_name: 'location_id',
        data_type: 'uuid',
        is_nullable: 'YES',
      },
      {
        table_name: 'tickets',
        column_name: 'resolution_summary',
        data_type: 'text',
        is_nullable: 'YES',
      },
      {
        table_name: 'tickets',
        column_name: 'ticket_number',
        data_type: 'bigint',
        is_nullable: 'NO',
      },
      {
        table_name: 'tickets',
        column_name: 'type',
        data_type: 'character varying',
        is_nullable: 'NO',
      },
    ])
    expect(
      columns.find((column) => column.column_name === 'asset_code')
        ?.column_default,
    ).toContain('asset_code_seq')
    expect(
      columns.find((column) => column.column_name === 'is_shared')
        ?.column_default,
    ).toContain('false')
    expect(
      columns.find((column) => column.column_name === 'type')?.column_default,
    ).toContain('INCIDENT')

    const constraints = (await dataSource.query(
      `SELECT conname
       FROM pg_constraint
       WHERE connamespace = 'public'::regnamespace
         AND conname = ANY($1::text[])
       ORDER BY conname`,
      [
        [
          'tickets_location_id_fkey',
          'tickets_type_check',
          'assets_pkey',
          'roles_code_key',
        ],
      ],
    )) as Array<{ conname: string }>
    expect(constraints.map((row) => row.conname)).toEqual([
      'assets_pkey',
      'roles_code_key',
      'tickets_location_id_fkey',
      'tickets_type_check',
    ])

    const indexes = (await dataSource.query(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = ANY($1::text[])
       ORDER BY indexname`,
      [
        [
          'idx_assets_asset_code',
          'idx_tickets_location',
          'idx_tickets_type_created',
        ],
      ],
    )) as Array<{ indexname: string }>
    expect(indexes.map((row) => row.indexname)).toEqual([
      'idx_assets_asset_code',
      'idx_tickets_location',
      'idx_tickets_type_created',
    ])

    const assetTag = (await dataSource.query(
      `SELECT character_maximum_length
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'assets'
         AND column_name = 'asset_tag'`,
    )) as Array<{ character_maximum_length: number }>
    expect(assetTag[0]?.character_maximum_length).toBe(100)

    const viewTags = (await dataSource.query(
      `SELECT table_name, character_maximum_length
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
         AND column_name = 'asset_tag'
       ORDER BY table_name`,
      [['v_asset_inventory', 'v_ticket_overview']],
    )) as Array<{ table_name: string; character_maximum_length: number }>
    expect(viewTags).toEqual([
      { table_name: 'v_asset_inventory', character_maximum_length: 100 },
      { table_name: 'v_ticket_overview', character_maximum_length: 100 },
    ])
  })
})

describe('report aggregation against PostgreSQL', () => {
  it('filters inclusive date boundaries and aggregates real ticket rows', async () => {
    const fixture = {
      userId: randomUUID(),
      categoryId: randomUUID(),
      ticketIds: Array.from({ length: 5 }, () => randomUUID()),
      suffix: randomUUID(),
    }
    const tickets = [
      {
        id: fixture.ticketIds[0],
        subject: 'Inside start date',
        priority: 'HIGH',
        status: 'OPEN',
        type: 'INCIDENT',
        createdAt: '2026-10-01T00:00:00.000Z',
        resolvedAt: null,
        deletedAt: null,
        categoryId: fixture.categoryId,
      },
      {
        id: fixture.ticketIds[1],
        subject: 'Inside end date',
        priority: 'LOW',
        status: 'RESOLVED',
        type: 'SERVICE_REQUEST',
        createdAt: '2026-10-02T23:59:59.999Z',
        resolvedAt: '2026-10-02T12:00:00.000Z',
        deletedAt: null,
        categoryId: null,
      },
      {
        id: fixture.ticketIds[2],
        subject: 'Created before range but resolved in range',
        priority: 'MEDIUM',
        status: 'RESOLVED',
        type: 'INCIDENT',
        createdAt: '2026-09-30T23:59:59.999Z',
        resolvedAt: '2026-10-02T13:00:00.000Z',
        deletedAt: null,
        categoryId: fixture.categoryId,
      },
      {
        id: fixture.ticketIds[3],
        subject: 'At exclusive end boundary',
        priority: 'CRITICAL',
        status: 'OPEN',
        type: 'INCIDENT',
        createdAt: '2026-10-03T00:00:00.000Z',
        resolvedAt: null,
        deletedAt: null,
        categoryId: fixture.categoryId,
      },
      {
        id: fixture.ticketIds[4],
        subject: 'Deleted in range',
        priority: 'CRITICAL',
        status: 'OPEN',
        type: 'INCIDENT',
        createdAt: '2026-10-02T12:00:00.000Z',
        resolvedAt: null,
        deletedAt: '2026-10-02T13:00:00.000Z',
        categoryId: fixture.categoryId,
      },
    ]
    const timezoneUrl = new URL(databaseUrl)
    timezoneUrl.searchParams.set('options', '-c TimeZone=Pacific/Kiritimati')
    const timezoneDataSource = new DataSource(
      createDatabaseOptions(timezoneUrl.toString()),
    )

    try {
      await timezoneDataSource.initialize()
      const timezoneRows = (await timezoneDataSource.query(
        `SELECT current_database() AS database_name,
                current_setting('TimeZone') AS timezone`,
      )) as Array<{ database_name: string; timezone: string }>
      expect(timezoneRows).toEqual([
        {
          database_name: expectedDatabaseName,
          timezone: 'Pacific/Kiritimati',
        },
      ])

      await dataSource.transaction(async (manager) => {
        await manager.query(
          `INSERT INTO public.users (id, full_name, email, password_hash)
           VALUES ($1, 'Integration Report User', $2, 'not-a-login-credential')`,
          [fixture.userId, `report-${fixture.suffix}@example.test`],
        )
        await manager.query(
          `INSERT INTO public.ticket_categories (id, code, name)
           VALUES ($1, $2, 'Integration Report Category')`,
          [fixture.categoryId, `REPORT-${fixture.suffix.slice(0, 30)}`],
        )
        for (const ticket of tickets) {
          await manager.query(
            `INSERT INTO public.tickets
               (id, subject, description, requester_id, category_id,
                priority, status, type, created_at, resolved_at, deleted_at)
             VALUES ($1, $2, 'Integration test fixture', $3, $4,
                     $5, $6, $7, $8, $9, $10)`,
            [
              ticket.id,
              ticket.subject,
              fixture.userId,
              ticket.categoryId,
              ticket.priority,
              ticket.status,
              ticket.type,
              ticket.createdAt,
              ticket.resolvedAt,
              ticket.deletedAt,
            ],
          )
        }
      })

      const result = await new ReportsService(timezoneDataSource).tickets({
        startDate: '2026-10-01',
        endDate: '2026-10-02',
      })

      expect(result).toMatchObject({
        period: { startDate: '2026-10-01', endDate: '2026-10-02' },
        totalCreated: 2,
        byStatus: [
          { name: 'OPEN', count: 1 },
          { name: 'RESOLVED', count: 1 },
        ],
        byPriority: [
          { name: 'HIGH', count: 1 },
          { name: 'LOW', count: 1 },
        ],
        byCategory: [
          { name: 'Integration Report Category', count: 1 },
          { name: 'Uncategorized', count: 1 },
        ],
        byType: [
          { name: 'INCIDENT', count: 1 },
          { name: 'SERVICE_REQUEST', count: 1 },
        ],
        resolvedInPeriod: 2,
        trend: [
          { date: '2026-10-01', count: 1 },
          { date: '2026-10-02', count: 1 },
        ],
      })
    } finally {
      if (timezoneDataSource.isInitialized) {
        await timezoneDataSource.destroy()
      }
      await dataSource.transaction(async (manager) => {
        await manager.query(
          'DELETE FROM public.tickets WHERE id = ANY($1::uuid[])',
          [fixture.ticketIds],
        )
        await manager.query(
          'DELETE FROM public.ticket_categories WHERE id = $1',
          [fixture.categoryId],
        )
        await manager.query('DELETE FROM public.users WHERE id = $1', [
          fixture.userId,
        ])
      })
    }
  })
})

describe('asset and ticket write paths against PostgreSQL', () => {
  it('creates and retrieves a long-tag asset with status history and audit', async () => {
    const fixture = {
      userId: randomUUID(),
      categoryId: randomUUID(),
      requestId: `asset-create-${randomUUID()}`,
      suffix: randomUUID(),
    }
    const assetTag = `IT-${fixture.suffix.replace(/-/g, '')}${'X'.repeat(40)}`
    const user: AuthenticatedUser = {
      id: fixture.userId,
      fullName: 'Integration Asset User',
      email: `asset-${fixture.suffix}@example.test`,
      roles: ['ADMIN'],
      permissions: ['assets.create', 'assets.read', 'assets.read.all'],
    }
    const request = {
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'itsm-integration-test',
        'x-request-id': fixture.requestId,
      },
    } as unknown as Request
    let assetId: string | null = null

    try {
      await dataSource.transaction(async (manager) => {
        await manager.query(
          `INSERT INTO public.users (id, full_name, email, password_hash)
           VALUES ($1, $2, $3, 'integration-fixture-not-a-credential')`,
          [user.id, user.fullName, user.email],
        )
        await manager.query(
          `INSERT INTO public.asset_categories (id, code, name)
           VALUES ($1, $2, 'Integration Asset Category')`,
          [fixture.categoryId, `ASSET-${fixture.suffix.slice(0, 30)}`],
        )
      })

      const dto: CreateAssetDto = {
        assetTag,
        name: 'Integration Test Laptop',
        categoryId: fixture.categoryId,
      }
      const asset = await new AssetsService(dataSource, {
        get: () => undefined,
      } as unknown as ConfigService).create(dto, user, request)
      assetId = asset.id

      expect(asset).toMatchObject({
        assetTag,
        name: 'Integration Test Laptop',
        status: 'AVAILABLE',
      })
      expect(asset.assetCode).toMatch(/^AST-/)

      const history = (await dataSource.query(
        `SELECT new_status FROM public.asset_status_history
         WHERE asset_id = $1 ORDER BY changed_at`,
        [asset.id],
      )) as Array<{ new_status: string }>
      expect(history).toEqual([{ new_status: 'AVAILABLE' }])

      const inventoryViewRows = (await dataSource.query(
        `SELECT asset_id, asset_tag, asset_name, category_name
         FROM public.v_asset_inventory WHERE asset_id = $1`,
        [asset.id],
      )) as Array<{
        asset_id: string
        asset_tag: string
        asset_name: string
        category_name: string
      }>
      expect(inventoryViewRows).toEqual([
        {
          asset_id: asset.id,
          asset_tag: assetTag,
          asset_name: 'Integration Test Laptop',
          category_name: 'Integration Asset Category',
        },
      ])

      const audit = (await dataSource.query(
        `SELECT action FROM public.audit_logs WHERE request_id = $1`,
        [fixture.requestId],
      )) as Array<{ action: string }>
      expect(audit).toEqual([{ action: 'assets.created' }])

      const rollbackRunner = dataSource.createQueryRunner()
      await rollbackRunner.connect()
      try {
        await expect(
          new ExpandAssetTagLength1792392250000().down(rollbackRunner),
        ).rejects.toThrow(
          'Cannot shrink asset_tag to varchar(60) while longer asset tags exist',
        )
      } finally {
        await rollbackRunner.release()
      }
    } finally {
      await dataSource.transaction(async (manager) => {
        const auditRows = (await manager.query(
          `DELETE FROM public.audit_logs WHERE request_id = $1
           RETURNING entity_id`,
          [fixture.requestId],
        )) as Array<{ entity_id: string | null }>
        const assetIds = [
          ...new Set(
            [assetId, ...auditRows.map((row) => row.entity_id)].filter(
              (id): id is string => id !== null,
            ),
          ),
        ]
        if (assetIds.length) {
          await manager.query(
            'DELETE FROM public.asset_status_history WHERE asset_id = ANY($1::uuid[])',
            [assetIds],
          )
          await manager.query(
            'DELETE FROM public.assets WHERE id = ANY($1::uuid[])',
            [assetIds],
          )
        }
        await manager.query(
          'DELETE FROM public.asset_categories WHERE id = $1',
          [fixture.categoryId],
        )
        await manager.query('DELETE FROM public.users WHERE id = $1', [user.id])
      })
    }
  })

  it('creates a ticket with database-generated number, initial history, and audit', async () => {
    const fixture = {
      userId: randomUUID(),
      categoryId: randomUUID(),
      requestId: `ticket-create-${randomUUID()}`,
      suffix: randomUUID(),
    }
    const user: AuthenticatedUser = {
      id: fixture.userId,
      fullName: 'Integration Ticket User',
      email: `ticket-${fixture.suffix}@example.test`,
      roles: ['USER'],
      permissions: ['tickets.create', 'tickets.read.own'],
    }
    const request = {
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'itsm-integration-test',
        'x-request-id': fixture.requestId,
      },
    } as unknown as Request
    let ticketId: string | null = null

    try {
      await dataSource.transaction(async (manager) => {
        await manager.query(
          `INSERT INTO public.users (id, full_name, email, password_hash)
           VALUES ($1, $2, $3, 'integration-fixture-not-a-credential')`,
          [user.id, user.fullName, user.email],
        )
        await manager.query(
          `INSERT INTO public.ticket_categories (id, code, name)
           VALUES ($1, $2, 'Integration Ticket Category')`,
          [fixture.categoryId, `TICKET-${fixture.suffix.slice(0, 30)}`],
        )
      })

      const dto: CreateTicketDto = {
        subject: '  Integration ticket  ',
        description: '  Created against PostgreSQL  ',
        categoryId: fixture.categoryId,
        type: 'INCIDENT',
      }
      const ticket = await new TicketsService(dataSource).create(
        dto,
        user,
        request,
      )
      ticketId = ticket.id

      expect(ticket).toMatchObject({
        subject: 'Integration ticket',
        description: 'Created against PostgreSQL',
        type: 'INCIDENT',
        status: 'OPEN',
        requester: { id: user.id },
      })
      expect(ticket.ticketNumber).toMatch(/^TCK-\d{4}-\d{6}$/)

      const history = (await dataSource.query(
        `SELECT previous_status, new_status, reason
         FROM public.ticket_status_history WHERE ticket_id = $1`,
        [ticket.id],
      )) as Array<{
        previous_status: string | null
        new_status: string
        reason: string
      }>
      expect(history).toEqual([
        {
          previous_status: null,
          new_status: 'OPEN',
          reason: 'Ticket created',
        },
      ])

      const ticketOverviewRows = (await dataSource.query(
        `SELECT id, subject, requester_name, category_name, asset_tag
         FROM public.v_ticket_overview WHERE id = $1`,
        [ticket.id],
      )) as Array<{
        id: string
        subject: string
        requester_name: string
        category_name: string
        asset_tag: string | null
      }>
      expect(ticketOverviewRows).toEqual([
        {
          id: ticket.id,
          subject: 'Integration ticket',
          requester_name: 'Integration Ticket User',
          category_name: 'Integration Ticket Category',
          asset_tag: null,
        },
      ])

      const audit = (await dataSource.query(
        `SELECT action FROM public.audit_logs WHERE request_id = $1`,
        [fixture.requestId],
      )) as Array<{ action: string }>
      expect(audit).toEqual([{ action: 'tickets.created' }])
    } finally {
      await dataSource.transaction(async (manager) => {
        const auditRows = (await manager.query(
          `DELETE FROM public.audit_logs WHERE request_id = $1
           RETURNING entity_id`,
          [fixture.requestId],
        )) as Array<{ entity_id: string | null }>
        const ticketIds = [
          ...new Set(
            [ticketId, ...auditRows.map((row) => row.entity_id)].filter(
              (id): id is string => id !== null,
            ),
          ),
        ]
        if (ticketIds.length) {
          await manager.query(
            'DELETE FROM public.ticket_status_history WHERE ticket_id = ANY($1::uuid[])',
            [ticketIds],
          )
          await manager.query(
            'DELETE FROM public.tickets WHERE id = ANY($1::uuid[])',
            [ticketIds],
          )
        }
        await manager.query(
          'DELETE FROM public.ticket_categories WHERE id = $1',
          [fixture.categoryId],
        )
        await manager.query('DELETE FROM public.users WHERE id = $1', [user.id])
      })
    }
  })
})

describe('PostgreSQL migration failure recovery', () => {
  it('does not leave application data or a migration record after failure', async () => {
    const migrationName = `ControlledFailure${Date.now()}`
    const probeKey = `migration-failure-${randomUUID()}`
    class ControlledFailingMigration implements MigrationInterface {
      name = migrationName

      async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
          `INSERT INTO public.app_settings (key, value)
           VALUES ($1, '{"probe":true}'::jsonb)`,
          [probeKey],
        )
        throw new Error('controlled migration failure')
      }

      async down(): Promise<void> {
        throw new Error('Controlled failure migration is test-only')
      }
    }
    const migrationDataSource = new DataSource({
      ...createDatabaseOptions(databaseUrl),
      migrations: [ControlledFailingMigration],
    })

    await migrationDataSource.initialize()
    try {
      await expect(
        migrationDataSource.runMigrations({ transaction: 'all' }),
      ).rejects.toThrow('controlled migration failure')
      const rows = (await dataSource.query(
        'SELECT key FROM public.app_settings WHERE key = $1',
        [probeKey],
      )) as Array<{ key: string }>
      expect(rows).toEqual([])

      const history = (await dataSource.query(
        'SELECT name FROM public.typeorm_migrations WHERE name = $1',
        [migrationName],
      )) as Array<{ name: string }>
      expect(history).toEqual([])
    } finally {
      await migrationDataSource.destroy()
    }
  })
})
