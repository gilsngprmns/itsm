import 'reflect-metadata'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NestFactory } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import argon2 from 'argon2'
import { DataSource } from 'typeorm'
import { AppModule } from '../src/app.module'
import { configureApplication } from '../src/configure-application'
import { createDatabaseOptions } from '../src/database/database-options'
import { requireIsolatedTestDatabaseUrl } from '../src/database/test-database-url'

const databaseUrl = requireIsolatedTestDatabaseUrl(
  process.env.TEST_DATABASE_URL,
)
const expectedDatabaseName = decodeURIComponent(
  new URL(databaseUrl).pathname.slice(1),
)
const dataSource = new DataSource(createDatabaseOptions(databaseUrl))
const fixture = {
  adminId: randomUUID(),
  employeeId: randomUUID(),
  otherEmployeeId: randomUUID(),
  supportId: randomUUID(),
  assetCategoryId: randomUUID(),
  ticketCategoryId: randomUUID(),
  suffix: randomUUID(),
}
const fixtureUserIds = [
  fixture.adminId,
  fixture.employeeId,
  fixture.otherEmployeeId,
  fixture.supportId,
]
const fixtureEmails = {
  admin: `http-admin-${fixture.suffix}@example.test`,
  employee: `http-employee-${fixture.suffix}@example.test`,
  otherEmployee: `http-other-${fixture.suffix}@example.test`,
  support: `http-support-${fixture.suffix}@example.test`,
}
const requestIds: string[] = []
const sessionCookies = new Map<string, string>()
const testPassword = `Integration-only-${randomUUID()}`
const assetTag = `HTTP-${fixture.suffix.replace(/-/g, '')}`
const ticketSubject = `HTTP integration ${fixture.suffix}`
const allowedOrigin = 'http://localhost:5173'
const originalEnvironment = new Map<string, string | undefined>()
let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined
let apiBaseUrl: string

beforeAll(async () => {
  await dataSource.initialize()
  const rows = (await dataSource.query(
    'SELECT current_database() AS database_name',
  )) as Array<{ database_name: string }>
  if (rows[0]?.database_name !== expectedDatabaseName) {
    throw new Error(
      'HTTP integration tests connected to an unexpected database',
    )
  }
  await dataSource.runMigrations({ transaction: 'all' })
  await createFixtures()

  for (const [key, value] of Object.entries({
    DATABASE_URL: databaseUrl,
    NODE_ENV: 'test',
    PORT: '0',
    CORS_ORIGINS: allowedOrigin,
    SESSION_COOKIE_NAME: 'itsm_session',
    AUTH_SESSION_TTL_MINUTES: '30',
  })) {
    originalEnvironment.set(key, process.env[key])
    process.env[key] = value
  }

  try {
    app = await NestFactory.create(AppModule)
    configureApplication(app, app.get(ConfigService))
    await app.listen(0, '127.0.0.1')
    const address = app.getHttpServer().address() as AddressInfo | null
    if (!address || typeof address === 'string') {
      throw new Error('HTTP integration server did not bind to a TCP port')
    }
    apiBaseUrl = `http://127.0.0.1:${address.port}/api/v1`
  } finally {
    restoreEnvironment()
  }
})

afterAll(async () => {
  try {
    if (app) {
      await app.close()
    }
  } finally {
    try {
      if (dataSource.isInitialized) {
        await cleanupFixtures()
      }
    } finally {
      if (dataSource.isInitialized) {
        await dataSource.destroy()
      }
      restoreEnvironment()
    }
  }
})

describe('authenticated HTTP workflows against isolated PostgreSQL', () => {
  it('enforces authentication, validates credentials, and establishes role sessions', async () => {
    const unauthenticated = await request('GET', '/assets')
    expect(unauthenticated.status).toBe(401)
    const invalidSession = await request('GET', '/assets', {
      cookie: 'itsm_session=expired-or-invalid-token',
    })
    expect(invalidSession.status).toBe(401)

    const invalidCredentials = await request('POST', '/auth/login', {
      body: { email: fixtureEmails.employee, password: 'incorrect-password' },
    })
    expect(invalidCredentials.status).toBe(401)

    for (const [key, email] of Object.entries(fixtureEmails)) {
      const login = await request('POST', '/auth/login', {
        body: { email, password: testPassword },
      })
      expect(login.status).toBe(200)
      const cookie = getSessionCookie(login.response)
      sessionCookies.set(key, cookie)
    }

    const currentUser = await request('GET', '/auth/me', {
      cookie: sessionCookies.get('admin'),
    })
    expect(currentUser.status).toBe(200)
    expect(currentUser.payload).toMatchObject({
      user: {
        id: fixture.adminId,
        roles: ['ADMIN'],
      },
    })

    const deniedAssetCreate = await request('POST', '/assets', {
      cookie: sessionCookies.get('employee'),
      body: {
        assetTag,
        name: 'Unauthorized asset',
        categoryId: fixture.assetCategoryId,
      },
    })
    expect(deniedAssetCreate.status).toBe(403)

    const deniedReportAccess = await request('GET', '/reports/tickets', {
      cookie: sessionCookies.get('employee'),
    })
    expect(deniedReportAccess.status).toBe(403)

    const invalidBody = await request('POST', '/assets', {
      cookie: sessionCookies.get('admin'),
      body: {
        assetTag,
        name: 'Invalid request',
        categoryId: fixture.assetCategoryId,
        unexpected: true,
      },
    })
    expect(invalidBody.status).toBe(400)
  })

  it('creates, updates, assigns, releases, and enforces asset ownership', async () => {
    const created = await request('POST', '/assets', {
      cookie: sessionCookies.get('admin'),
      body: {
        assetTag,
        name: 'HTTP Integration Laptop',
        categoryId: fixture.assetCategoryId,
      },
    })
    expect(created.status).toBe(201)
    expect(created.payload).toMatchObject({
      assetTag,
      name: 'HTTP Integration Laptop',
      status: 'AVAILABLE',
    })
    const assetId = readId(created.payload)

    const duplicate = await request('POST', '/assets', {
      cookie: sessionCookies.get('admin'),
      body: {
        assetTag,
        name: 'Duplicate HTTP Integration Laptop',
        categoryId: fixture.assetCategoryId,
      },
    })
    expect(duplicate.status).toBe(409)

    const update = await request('PATCH', `/assets/${assetId}`, {
      cookie: sessionCookies.get('admin'),
      body: { name: 'Updated HTTP Integration Laptop' },
    })
    expect(update.status).toBe(200)
    expect(update.payload).toMatchObject({
      id: assetId,
      name: 'Updated HTTP Integration Laptop',
    })

    const listedAssets = await request('GET', '/assets?search=Updated%20HTTP', {
      cookie: sessionCookies.get('admin'),
    })
    expect(listedAssets.status).toBe(200)
    expect(listedAssets.payload).toMatchObject({
      items: [
        expect.objectContaining({
          id: assetId,
          name: 'Updated HTTP Integration Laptop',
        }),
      ],
      total: 1,
    })

    const objectDenied = await request('GET', `/assets/${assetId}`, {
      cookie: sessionCookies.get('employee'),
    })
    expect(objectDenied.status).toBe(404)

    const assigned = await request('POST', `/assets/${assetId}/assignments`, {
      cookie: sessionCookies.get('admin'),
      body: { userId: fixture.employeeId },
    })
    expect(assigned.status).toBe(201)
    expect(assigned.payload).toMatchObject({
      id: assetId,
      status: 'ASSIGNED',
      assignedUser: { id: fixture.employeeId },
    })
    const assignedUserCanRead = await request('GET', `/assets/${assetId}`, {
      cookie: sessionCookies.get('employee'),
    })
    expect(assignedUserCanRead.status).toBe(200)
    expect(assignedUserCanRead.payload).toMatchObject({
      id: assetId,
      assignedUser: { id: fixture.employeeId },
    })

    const released = await request(
      'POST',
      `/assets/${assetId}/assignments/release`,
      { cookie: sessionCookies.get('admin') },
    )
    expect(released.status).toBe(201)
    expect(released.payload).toMatchObject({
      id: assetId,
      status: 'AVAILABLE',
    })

    const invalidStatus = await request('PATCH', `/assets/${assetId}/status`, {
      cookie: sessionCookies.get('admin'),
      body: { status: 'ASSIGNED' },
    })
    expect(invalidStatus.status).toBe(409)
  })

  it('creates and scopes tickets, tests support transitions, history, and reports', async () => {
    const reportDate = new Date().toISOString().slice(0, 10)
    const reportPath = `/reports/tickets?startDate=${reportDate}&endDate=${reportDate}`
    const reportBefore = await request('GET', reportPath, {
      cookie: sessionCookies.get('admin'),
    })
    expect(reportBefore.status).toBe(200)
    const totalBefore = readTotalCreated(reportBefore.payload)

    const created = await request('POST', '/tickets', {
      cookie: sessionCookies.get('employee'),
      body: {
        type: 'INCIDENT',
        subject: ticketSubject,
        description: 'Created using an authenticated HTTP request.',
        categoryId: fixture.ticketCategoryId,
      },
    })
    expect(created.status).toBe(201)
    expect(created.payload).toMatchObject({
      subject: ticketSubject,
      status: 'OPEN',
      requester: { id: fixture.employeeId },
    })
    const ticketId = readId(created.payload)

    const invalidTicket = await request('POST', '/tickets', {
      cookie: sessionCookies.get('employee'),
      body: {
        type: 'INCIDENT',
        subject: 'Invalid request',
        description: 'Unknown fields are rejected.',
        categoryId: fixture.ticketCategoryId,
        requesterId: fixture.otherEmployeeId,
      },
    })
    expect(invalidTicket.status).toBe(400)

    const ownTicket = await request('GET', `/tickets/${ticketId}`, {
      cookie: sessionCookies.get('employee'),
    })
    expect(ownTicket.status).toBe(200)

    const otherUsersTicket = await request('GET', `/tickets/${ticketId}`, {
      cookie: sessionCookies.get('otherEmployee'),
    })
    expect(otherUsersTicket.status).toBe(404)

    const forbiddenAssignment = await request(
      'POST',
      `/tickets/${ticketId}/assign-to-me`,
      { cookie: sessionCookies.get('employee') },
    )
    expect(forbiddenAssignment.status).toBe(403)

    const selfAssigned = await request(
      'POST',
      `/tickets/${ticketId}/assign-to-me`,
      { cookie: sessionCookies.get('support') },
    )
    expect(selfAssigned.status).toBe(201)
    expect(selfAssigned.payload).toMatchObject({
      id: ticketId,
      assignee: { id: fixture.supportId },
    })

    const inProgress = await request('PATCH', `/tickets/${ticketId}/status`, {
      cookie: sessionCookies.get('support'),
      body: { status: 'IN_PROGRESS', reason: 'Started by support' },
    })
    expect(inProgress.status).toBe(200)
    expect(inProgress.payload).toMatchObject({ status: 'IN_PROGRESS' })

    const invalidTransition = await request(
      'PATCH',
      `/tickets/${ticketId}/status`,
      {
        cookie: sessionCookies.get('support'),
        body: { status: 'OPEN' },
      },
    )
    expect(invalidTransition.status).toBe(409)

    const resolved = await request('PATCH', `/tickets/${ticketId}/status`, {
      cookie: sessionCookies.get('support'),
      body: {
        status: 'RESOLVED',
        resolutionSummary: 'Resolved by integration test support.',
      },
    })
    expect(resolved.status).toBe(200)
    expect(resolved.payload).toMatchObject({
      status: 'RESOLVED',
      resolutionSummary: 'Resolved by integration test support.',
    })

    const history = await request('GET', `/tickets/${ticketId}/history`, {
      cookie: sessionCookies.get('support'),
    })
    expect(history.status).toBe(200)
    expect(JSON.stringify(history.payload)).toContain('IN_PROGRESS')
    expect(JSON.stringify(history.payload)).toContain('RESOLVED')

    const reportAfter = await request('GET', reportPath, {
      cookie: sessionCookies.get('admin'),
    })
    expect(reportAfter.status).toBe(200)
    expect(readTotalCreated(reportAfter.payload)).toBe(totalBefore + 1)
    expect(
      readCount(reportAfter.payload, 'byType', 'INCIDENT'),
    ).toBeGreaterThan(readCount(reportBefore.payload, 'byType', 'INCIDENT'))

    const auditRows = (await dataSource.query(
      `SELECT action FROM public.audit_logs
       WHERE entity_id = $1
       ORDER BY created_at, action`,
      [ticketId],
    )) as Array<{ action: string }>
    expect(auditRows.map((row) => row.action)).toContain('tickets.created')
    expect(auditRows.map((row) => row.action)).toContain(
      'tickets.status_changed',
    )
  })

  it('validates multipart CSV uploads through the real API pipeline', async () => {
    const validCsv = [
      'assetTag,name,categoryCode',
      `${csvImportAssetTag()},Imported asset,HTTP${fixture.suffix.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
    ].join('\n')
    const previewCsv = [
      'assetTag,name,categoryCode',
      `HTTP-PREVIEW-${fixture.suffix.replace(/-/g, '')},Preview asset,HTTP${fixture.suffix.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
    ].join('\n')
    const valid = await uploadCsv('preview.csv', previewCsv)
    expect(valid.status).toBe(201)
    expect(valid.payload).toMatchObject({
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
    })

    const imported = await uploadCsv('import.csv', validCsv, '/assets/import')
    expect(imported.status).toBe(201)
    expect(imported.payload).toMatchObject({
      mode: 'CREATE_ONLY',
      totalRows: 1,
      createdRows: 1,
      rejectedRows: 0,
    })
    const importedAsset = (await dataSource.query(
      `SELECT a.asset_tag, a.name, l.action
       FROM public.assets a
       JOIN public.audit_logs l ON l.entity_id = a.id
       WHERE a.asset_tag = $1 AND l.action = 'assets.created'`,
      [csvImportAssetTag()],
    )) as Array<{ asset_tag: string; name: string; action: string }>
    expect(importedAsset).toEqual([
      {
        asset_tag: csvImportAssetTag(),
        name: 'Imported asset',
        action: 'assets.created',
      },
    ])

    const invalidRowsCsv = [
      'assetTag,name,categoryCode',
      `HTTP-INVALID-FIRST-${fixture.suffix.replace(/-/g, '')},Valid first row,HTTP${fixture.suffix.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
      `HTTP-INVALID-${fixture.suffix.replace(/-/g, '')},Invalid category,UNKNOWN`,
    ].join('\n')
    const invalidImport = await uploadCsv(
      'invalid-rows.csv',
      invalidRowsCsv,
      '/assets/import',
    )
    expect(invalidImport.status).toBe(422)
    const rejectedAssetRows = (await dataSource.query(
      'SELECT count(*)::int AS count FROM public.assets WHERE asset_tag = ANY($1::text[])',
      [
        [
          `HTTP-INVALID-FIRST-${fixture.suffix.replace(/-/g, '')}`,
          `HTTP-INVALID-${fixture.suffix.replace(/-/g, '')}`,
        ],
      ],
    )) as Array<{ count: number }>
    expect(rejectedAssetRows[0]?.count).toBe(0)

    const wrongExtension = await uploadCsv('preview.txt', previewCsv)
    expect(wrongExtension.status).toBe(400)

    const malformed = await uploadCsv(
      'malformed.csv',
      'assetTag,name,categoryCode\n"unterminated,Preview,UNKNOWN',
    )
    expect(malformed.status).toBe(400)

    const missingFile = await request('POST', '/assets/import/preview', {
      cookie: sessionCookies.get('admin'),
      formData: new FormData(),
    })
    expect(missingFile.status).toBe(400)

    const oversized = await uploadCsv(
      'oversized.csv',
      `assetTag,name,categoryCode\n${'x'.repeat(5 * 1024 * 1024)}`,
    )
    expect(oversized.status).toBe(413)
  })
})

async function createFixtures(): Promise<void> {
  const passwordHash = await argon2.hash(testPassword)
  await dataSource.transaction(async (manager) => {
    for (const [id, fullName, email, roleCode] of [
      [fixture.adminId, 'HTTP Integration Admin', fixtureEmails.admin, 'ADMIN'],
      [
        fixture.employeeId,
        'HTTP Integration Employee',
        fixtureEmails.employee,
        'USER',
      ],
      [
        fixture.otherEmployeeId,
        'HTTP Integration Other Employee',
        fixtureEmails.otherEmployee,
        'USER',
      ],
      [
        fixture.supportId,
        'HTTP Integration Support',
        fixtureEmails.support,
        'IT_SUPPORT',
      ],
    ] as const) {
      await manager.query(
        `INSERT INTO public.users (id, full_name, email, password_hash)
         VALUES ($1, $2, $3, $4)`,
        [id, fullName, email, passwordHash],
      )
      await manager.query(
        `INSERT INTO public.user_roles (user_id, role_id)
         SELECT $1, id FROM public.roles WHERE code = $2`,
        [id, roleCode],
      )
    }
    await manager.query(
      `INSERT INTO public.asset_categories (id, code, name)
       VALUES ($1, $2, 'HTTP Integration Category')`,
      [
        fixture.assetCategoryId,
        `HTTP${fixture.suffix.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
      ],
    )
    await manager.query(
      `INSERT INTO public.ticket_categories (id, code, name)
       VALUES ($1, $2, 'HTTP Integration Category')`,
      [
        fixture.ticketCategoryId,
        `HTTP-${fixture.suffix.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
      ],
    )
  })
}

async function cleanupFixtures(): Promise<void> {
  await dataSource.transaction(async (manager) => {
    const ticketIds = (await manager.query(
      'SELECT id FROM public.tickets WHERE requester_id = ANY($1::uuid[])',
      [[fixture.employeeId, fixture.otherEmployeeId]],
    )) as Array<{ id: string }>
    const tickets = ticketIds.map((row) => row.id)
    if (tickets.length) {
      await manager.query(
        'DELETE FROM public.ticket_attachments WHERE ticket_id = ANY($1::uuid[])',
        [tickets],
      )
      await manager.query(
        'DELETE FROM public.ticket_comments WHERE ticket_id = ANY($1::uuid[])',
        [tickets],
      )
      await manager.query(
        'DELETE FROM public.ticket_status_history WHERE ticket_id = ANY($1::uuid[])',
        [tickets],
      )
      await manager.query(
        'DELETE FROM public.ticket_type_history WHERE ticket_id = ANY($1::uuid[])',
        [tickets],
      )
      await manager.query(
        'DELETE FROM public.ticket_assignments WHERE ticket_id = ANY($1::uuid[])',
        [tickets],
      )
      await manager.query(
        'DELETE FROM public.tickets WHERE id = ANY($1::uuid[])',
        [tickets],
      )
    }

    const assets = (await manager.query(
      'SELECT id FROM public.assets WHERE asset_tag = ANY($1::text[])',
      [[assetTag, csvImportAssetTag()]],
    )) as Array<{ id: string }>
    const assetIds = assets.map((row) => row.id)
    if (assetIds.length) {
      await manager.query(
        'DELETE FROM public.asset_assignments WHERE asset_id = ANY($1::uuid[])',
        [assetIds],
      )
      await manager.query(
        'DELETE FROM public.asset_status_history WHERE asset_id = ANY($1::uuid[])',
        [assetIds],
      )
      await manager.query(
        'DELETE FROM public.asset_maintenance WHERE asset_id = ANY($1::uuid[])',
        [assetIds],
      )
      await manager.query(
        'DELETE FROM public.assets WHERE id = ANY($1::uuid[])',
        [assetIds],
      )
    }

    await manager.query(
      `DELETE FROM public.audit_logs
       WHERE actor_id = ANY($1::uuid[])
          OR request_id::text = ANY($2::text[])`,
      [fixtureUserIds, requestIds],
    )
    await manager.query(
      'DELETE FROM public.refresh_tokens WHERE user_id = ANY($1::uuid[])',
      [fixtureUserIds],
    )
    await manager.query(
      'DELETE FROM public.user_roles WHERE user_id = ANY($1::uuid[])',
      [fixtureUserIds],
    )
    await manager.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [
      fixtureUserIds,
    ])
    await manager.query('DELETE FROM public.asset_categories WHERE id = $1', [
      fixture.assetCategoryId,
    ])
    await manager.query('DELETE FROM public.ticket_categories WHERE id = $1', [
      fixture.ticketCategoryId,
    ])
  })
}

async function request(
  method: string,
  path: string,
  options: {
    body?: unknown
    cookie?: string
    formData?: FormData
  } = {},
): Promise<{ response: Response; status: number; payload: unknown }> {
  const requestId = `http-it-${randomUUID()}`
  requestIds.push(requestId)
  const headers: Record<string, string> = {
    origin: allowedOrigin,
    'x-request-id': requestId,
  }
  if (options.cookie) headers.cookie = options.cookie
  const init: RequestInit = { method, headers }
  if (options.formData) {
    init.body = options.formData
  } else if (options.body !== undefined) {
    headers['content-type'] = 'application/json'
    init.body = JSON.stringify(options.body)
  }
  const response = await fetch(`${apiBaseUrl}${path}`, init)
  const text = await response.text()
  let payload: unknown = text
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }
  return { response, status: response.status, payload }
}

async function uploadCsv(
  filename: string,
  content: string,
  path = '/assets/import/preview',
): Promise<{ response: Response; status: number; payload: unknown }> {
  const formData = new FormData()
  formData.append('file', new Blob([content], { type: 'text/csv' }), filename)
  return request('POST', path, {
    cookie: sessionCookies.get('admin'),
    formData,
  })
}

function csvImportAssetTag(): string {
  return `HTTP-CSV-${fixture.suffix.replace(/-/g, '')}`
}

function getSessionCookie(response: Response): string {
  const sessionCookie = response.headers
    .getSetCookie()
    .find(
      (value) =>
        value.startsWith('itsm_session=') && value.includes('Path=/api/v1;'),
    )
  if (!sessionCookie) {
    throw new Error('Login response did not set the API session cookie')
  }
  return sessionCookie.split(';', 1)[0]
}

function readId(payload: unknown): string {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('id' in payload) ||
    typeof payload.id !== 'string'
  ) {
    throw new Error('HTTP response did not contain a resource ID')
  }
  return payload.id
}

function readTotalCreated(payload: unknown): number {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('totalCreated' in payload) ||
    typeof payload.totalCreated !== 'number'
  ) {
    throw new Error('Report response did not include totalCreated')
  }
  return payload.totalCreated
}

function readCount(
  payload: unknown,
  collection: 'byType',
  name: string,
): number {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !(collection in payload) ||
    !Array.isArray(payload[collection])
  ) {
    throw new Error(`Report response did not include ${collection}`)
  }
  const row = payload[collection].find(
    (item): item is { name: string; count: number } =>
      typeof item === 'object' &&
      item !== null &&
      'name' in item &&
      item.name === name &&
      'count' in item &&
      typeof item.count === 'number',
  )
  return row?.count ?? 0
}

function restoreEnvironment(): void {
  for (const [key, value] of originalEnvironment) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  originalEnvironment.clear()
}
