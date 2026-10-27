import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import type { Request } from 'express'
import { ConfigService } from '@nestjs/config'
import QRCode from 'qrcode'
import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { DataSource, type EntityManager } from 'typeorm'
import { getPostgresErrorCode, writeAuditLog } from '../../common/audit-log'
import type { AuthenticatedUser } from '../auth/auth.types'
import {
  parseAssetCsv,
  serializeAssetCsv,
  validateAssetCsv,
  type AssetCsvPreview,
  type ParsedAssetCsv,
} from './asset-csv'
import { ASSET_STATUS_TRANSITIONS, type AssetStatus } from './asset-status'
import type { AssignAssetDto } from './dto/assign-asset.dto'
import type { AssetStatusDto } from './dto/asset-status.dto'
import type { CreateAssetDto } from './dto/create-asset.dto'
import type { ListAssetsDto } from './dto/list-assets.dto'
import type { UpdateAssetDto } from './dto/update-asset.dto'

interface AssetRow {
  id: string
  asset_code: string
  is_shared: boolean
  asset_tag: string
  name: string
  category_id: string
  category_code: string
  category_name: string
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  description: string | null
  status: AssetStatus
  condition: string
  purchase_date: string | null
  purchase_cost: string | null
  warranty_start: string | null
  warranty_end: string | null
  location_id: string | null
  location_code: string | null
  location_name: string | null
  notes: string | null
  created_at: Date
  updated_at: Date
  assigned_user_id: string | null
  assigned_user_name: string | null
  assigned_user_employee_code: string | null
}

interface AssetForUpdate {
  id: string
  is_shared: boolean
  asset_tag: string
  name: string
  category_id: string
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  description: string | null
  status: AssetStatus
  condition: string
  purchase_date: string | null
  purchase_cost: string | null
  warranty_start: string | null
  warranty_end: string | null
  location_id: string | null
  notes: string | null
}

export interface AssetResponse {
  id: string
  assetCode: string
  isShared: boolean
  assetTag: string
  name: string
  category: { id: string; code: string; name: string }
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  description: string | null
  status: AssetStatus
  condition: string
  purchaseDate: string | null
  purchaseCost: string | null
  warrantyStart: string | null
  warrantyEnd: string | null
  location: { id: string; code: string; name: string } | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
  assignedUser?: {
    id: string
    fullName: string
    employeeCode: string | null
  } | null
}

const ASSET_COLUMNS: Record<string, string> = {
  assetTag: 'a.asset_tag',
  name: 'a.name',
  status: 'a.status',
  createdAt: 'a.created_at',
}

@Injectable()
export class AssetsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async byCode(code: string, user: AuthenticatedUser): Promise<AssetResponse> {
    const rows = (await this.dataSource.query(
      `${assetSelect()} WHERE a.asset_code = $1 AND a.deleted_at IS NULL`,
      [code],
    )) as AssetRow[]
    if (!rows[0]) throw new NotFoundException('Asset not found')
    return this.get(rows[0].id, user)
  }

  async qr(id: string, user: AuthenticatedUser): Promise<string> {
    const asset = await this.get(id, user)
    const baseUrl = (
      this.config.get<string>('PUBLIC_WEB_URL') ||
      this.config.get<string>('CORS_ORIGINS')?.split(',')[0] ||
      ''
    ).replace(/\/$/, '')
    if (!baseUrl)
      throw new BadRequestException('Public web URL is not configured')
    return QRCode.toString(
      `${baseUrl}/assets/by-code/${encodeURIComponent(asset.assetCode)}`,
      {
        type: 'svg',
        margin: 1,
        width: 240,
      },
    )
  }

  async linkedTickets(
    id: string,
    query: { page?: number; limit?: number },
    user: AuthenticatedUser,
  ) {
    await this.get(id, user)
    const canReadAll = user.permissions.includes('tickets.read.all')
    if (!canReadAll && !user.permissions.includes('tickets.read.own')) {
      throw new ForbiddenException('Insufficient ticket permissions')
    }
    const page = query.page ?? 1
    const limit = query.limit ?? 10
    const accessClause = canReadAll ? '' : ' AND t.requester_id = $2'
    const params: unknown[] = canReadAll ? [id] : [id, user.id]
    const countRows = (await this.dataSource.query(
      `SELECT count(*)::int AS total,
        count(*) FILTER (WHERE t.status NOT IN ('CLOSED', 'CANCELLED', 'RESOLVED'))::int AS open,
        max(t.created_at) AS last_ticket_at
       FROM public.tickets t WHERE t.asset_id = $1 AND t.deleted_at IS NULL${accessClause}`,
      params,
    )) as Array<{ total: number; open: number; last_ticket_at: Date | null }>
    const rows = (await this.dataSource.query(
      `SELECT t.id, t.ticket_number::text AS ticket_number,
        to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY') AS ticket_year,
        t.subject, t.type, t.status, t.priority, t.created_at, t.resolved_at,
        requester.full_name AS requester_name, assignee.full_name AS assignee_name
       FROM public.tickets t
       JOIN public.users requester ON requester.id = t.requester_id
       LEFT JOIN public.users assignee ON assignee.id = t.assigned_to
       WHERE t.asset_id = $1 AND t.deleted_at IS NULL${accessClause}
       ORDER BY t.created_at DESC, t.id
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    )) as Array<Record<string, string | Date | null>>
    return {
      items: rows.map((row) => ({
        id: row.id,
        ticketNumber: `TCK-${row.ticket_year}-${String(row.ticket_number).padStart(6, '0')}`,
        subject: row.subject,
        type: row.type,
        status: row.status,
        priority: row.priority,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
        requesterName: row.requester_name,
        assigneeName: row.assignee_name,
      })),
      page,
      limit,
      total: Number(countRows[0]?.total ?? 0),
      open: Number(countRows[0]?.open ?? 0),
      lastTicketAt: countRows[0]?.last_ticket_at ?? null,
    }
  }

  async list(
    query: ListAssetsDto,
    user: AuthenticatedUser,
  ): Promise<{
    items: AssetResponse[]
    page: number
    limit: number
    total: number
  }> {
    const parameters: unknown[] = []
    const where = ['a.deleted_at IS NULL']
    const addFilter = (
      clause: (parameter: string) => string,
      value: unknown,
    ) => {
      parameters.push(value)
      where.push(clause(`$${parameters.length}`))
    }

    const canViewAll = hasAllAssetRead(user)
    if (!canViewAll) {
      addFilter(
        (parameter) =>
          `(a.is_shared = true OR EXISTS (SELECT 1 FROM public.asset_assignments own_assignment
                   WHERE own_assignment.asset_id = a.id
                     AND own_assignment.user_id = ${parameter}
                     AND own_assignment.returned_at IS NULL))`,
        user.id,
      )
    }
    if (query.search?.trim()) {
      const search = `%${query.search.trim()}%`
      addFilter(
        (parameter) =>
          `(a.asset_code ILIKE ${parameter} OR a.asset_tag ILIKE ${parameter} OR a.name ILIKE ${parameter} OR a.serial_number ILIKE ${parameter})`,
        search,
      )
    }
    if (query.status) {
      addFilter((parameter) => `a.status = ${parameter}`, query.status)
    }
    if (query.categoryId) {
      addFilter((parameter) => `a.category_id = ${parameter}`, query.categoryId)
    }
    if (query.locationId) {
      addFilter((parameter) => `a.location_id = ${parameter}`, query.locationId)
    }

    const filterSql = where.join(' AND ')
    const countRows = (await this.dataSource.query(
      `SELECT count(*)::int AS total
       FROM public.assets a
       WHERE ${filterSql}`,
      parameters,
    )) as Array<{ total: number }>
    const page = query.page || 1
    const limit = query.limit || 25
    const rows = (await this.dataSource.query(
      `${assetSelect()}
       WHERE ${filterSql}
       ORDER BY ${ASSET_COLUMNS[query.sort] || ASSET_COLUMNS.createdAt}
         ${query.order === 'asc' ? 'ASC' : 'DESC'}, a.id
       LIMIT $${parameters.length + 1} OFFSET $${parameters.length + 2}`,
      [...parameters, limit, (page - 1) * limit],
    )) as AssetRow[]
    return {
      items: rows.map((row) =>
        toAssetResponse(
          row,
          canViewAssignee(user) || row.assigned_user_id === user.id,
        ),
      ),
      page,
      limit,
      total: Number(countRows[0]?.total ?? 0),
    }
  }

  csvTemplate(): string {
    return serializeAssetCsv([])
  }

  async exportCsv(
    query: ListAssetsDto,
    user: AuthenticatedUser,
  ): Promise<string> {
    const parameters: unknown[] = []
    const where = ['a.deleted_at IS NULL']
    const addFilter = (condition: string, value: unknown) => {
      parameters.push(value)
      where.push(condition.replace('?', `$${parameters.length}`))
    }
    if (!hasAllAssetRead(user)) {
      addFilter(
        `(a.is_shared = true OR EXISTS (
          SELECT 1 FROM public.asset_assignments own_assignment
          WHERE own_assignment.asset_id = a.id
            AND own_assignment.user_id = ?
            AND own_assignment.returned_at IS NULL))`,
        user.id,
      )
    }
    if (query.search?.trim()) {
      parameters.push(`%${query.search.trim()}%`)
      const index = parameters.length
      where.push(
        `(a.asset_code ILIKE $${index} OR a.asset_tag ILIKE $${index}
          OR a.name ILIKE $${index} OR a.serial_number ILIKE $${index})`,
      )
    }
    if (query.status) addFilter('a.status = ?', query.status)
    if (query.categoryId) addFilter('a.category_id = ?', query.categoryId)
    if (query.locationId) addFilter('a.location_id = ?', query.locationId)

    const rows = (await this.dataSource.query(
      `${assetSelect()}
       WHERE ${where.join(' AND ')}
       ORDER BY a.asset_tag, a.id`,
      parameters,
    )) as AssetRow[]
    return serializeAssetCsv(
      rows.map((row) => ({
        assetTag: row.asset_tag,
        name: row.name,
        categoryCode: row.category_code,
        manufacturer: row.manufacturer,
        model: row.model,
        serialNumber: row.serial_number,
        description: row.description,
        locationCode: row.location_code,
        purchaseDate: row.purchase_date,
        purchaseCost: row.purchase_cost,
        warrantyStart: row.warranty_start,
        warrantyEnd: row.warranty_end,
        notes: row.notes,
      })),
    )
  }

  async previewCsvImport(
    buffer: Buffer,
    filename: string,
  ): Promise<AssetCsvPreview> {
    const parsed = parseAssetCsv(buffer, filename)
    const { preview } = await this.validateCsvImport(
      this.dataSource.manager,
      parsed,
    )
    return preview
  }

  async importCsv(
    buffer: Buffer,
    filename: string,
    user: AuthenticatedUser,
    request: Request,
  ): Promise<{
    operationId: string
    mode: 'CREATE_ONLY'
    totalRows: number
    createdRows: number
    updatedRows: 0
    rejectedRows: 0
  }> {
    const parsed = parseAssetCsv(buffer, filename)
    const operationId = randomUUID()
    try {
      return await this.dataSource.transaction(async (manager) => {
        const { preview, categories, locations } = await this.validateCsvImport(
          manager,
          parsed,
        )
        if (preview.invalidRows > 0) {
          throw new UnprocessableEntityException({
            message:
              'CSV validation failed. Correct the reported rows and retry.',
            preview,
          })
        }

        for (const row of parsed.rows) {
          const categoryCode = row.values.categoryCode.toUpperCase()
          const locationCode = row.values.locationCode.toUpperCase()
          const categoryId = categories.get(categoryCode)
          const locationId = locationCode
            ? locations.get(locationCode)
            : undefined
          if (!categoryId || (locationCode && !locationId)) {
            throw new ConflictException(
              'A category or location changed during import. Preview the file again.',
            )
          }
          await this.insertAsset(
            manager,
            assetCsvRowToDto(row, categoryId, locationId),
            user,
            request,
          )
        }

        await writeAuditLog(
          manager,
          request,
          user.id,
          'assets.csv_imported',
          'asset_import',
          operationId,
          null,
          {
            filename: safeFilename(filename),
            mode: 'CREATE_ONLY',
            totalRows: preview.totalRows,
            createdRows: preview.totalRows,
            rejectedRows: 0,
          },
        )
        return {
          operationId,
          mode: 'CREATE_ONLY',
          totalRows: preview.totalRows,
          createdRows: preview.totalRows,
          updatedRows: 0,
          rejectedRows: 0,
        }
      })
    } catch (error) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException(
          'An asset tag or serial number was added by another request. Preview the file again.',
        )
      }
      throw error
    }
  }

  async get(id: string, user: AuthenticatedUser): Promise<AssetResponse> {
    const clauses = ['a.id = $1', 'a.deleted_at IS NULL']
    const parameters: unknown[] = [id]
    if (!hasAllAssetRead(user)) {
      clauses.push(
        `(a.is_shared = true OR EXISTS (SELECT 1 FROM public.asset_assignments own_assignment
                 WHERE own_assignment.asset_id = a.id
                   AND own_assignment.user_id = $2
                   AND own_assignment.returned_at IS NULL))`,
      )
      parameters.push(user.id)
    }
    const rows = (await this.dataSource.query(
      `${assetSelect()}
       WHERE ${clauses.join(' AND ')}`,
      parameters,
    )) as AssetRow[]
    if (!rows[0]) throw new NotFoundException('Asset not found')
    return toAssetResponse(
      rows[0],
      canViewAssignee(user) || rows[0].assigned_user_id === user.id,
    )
  }

  async create(
    dto: CreateAssetDto,
    user: AuthenticatedUser,
    request: Request,
  ): Promise<AssetResponse> {
    const assetTag = dto.assetTag.trim()
    const name = dto.name.trim()
    if (!assetTag || !name) {
      throw new BadRequestException('Asset tag and name are required')
    }
    assertWarrantyRange(dto.warrantyStart, dto.warrantyEnd)

    try {
      const id = await this.dataSource.transaction(async (manager) => {
        return this.insertAsset(manager, dto, user, request)
      })
      return this.get(id, user)
    } catch (error) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException('Asset tag or serial number already exists')
      }
      throw error
    }
  }

  async update(
    id: string,
    dto: UpdateAssetDto,
    user: AuthenticatedUser,
    request: Request,
  ): Promise<AssetResponse> {
    assertWarrantyRange(dto.warrantyStart, dto.warrantyEnd)

    try {
      await this.dataSource.transaction(async (manager) => {
        const old = await this.getAssetForUpdate(manager, id)
        if (
          dto.isShared !== undefined &&
          !user.permissions.includes('assets.share')
        ) {
          throw new ForbiddenException(
            'Only administrators may change shared asset access',
          )
        }
        const next = mergeAsset(old, dto)
        if (!next.asset_tag.trim() || !next.name.trim()) {
          throw new BadRequestException('Asset tag and name are required')
        }
        if (dto.categoryId && dto.categoryId !== old.category_id) {
          await this.assertActiveCategory(manager, next.category_id)
        }
        if (
          dto.locationId &&
          next.location_id &&
          dto.locationId !== old.location_id
        ) {
          await this.assertActiveLocation(manager, next.location_id)
        }
        assertWarrantyRange(next.warranty_start, next.warranty_end)
        await manager.query(
          `UPDATE public.assets
           SET asset_tag = $2, name = $3, category_id = $4,
               manufacturer = $5, model = $6, serial_number = $7,
               description = $8, location_id = $9, purchase_date = $10,
               purchase_cost = $11, warranty_start = $12, warranty_end = $13,
               notes = $14, updated_by = $15,
               is_shared = COALESCE($16, is_shared), updated_at = now()
           WHERE id = $1`,
          [
            id,
            next.asset_tag,
            next.name,
            next.category_id,
            next.manufacturer,
            next.model,
            next.serial_number,
            next.description,
            next.location_id,
            next.purchase_date,
            next.purchase_cost,
            next.warranty_start,
            next.warranty_end,
            next.notes,
            user.id,
            dto.isShared ?? null,
          ],
        )
        const oldValues = changedFields(old, next)
        if (Object.keys(oldValues).length) {
          await writeAuditLog(
            manager,
            request,
            user.id,
            'assets.updated',
            'asset',
            id,
            oldValues,
            changedFields(next, old),
          )
        }
      })
      return this.get(id, user)
    } catch (error) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException('Asset tag or serial number already exists')
      }
      throw error
    }
  }

  async setStatus(
    id: string,
    dto: AssetStatusDto,
    user: AuthenticatedUser,
    request: Request,
  ): Promise<AssetResponse> {
    if (
      (dto.status === 'RETIRED' || dto.status === 'DISPOSED') &&
      !user.permissions.includes('assets.retire')
    ) {
      throw new ForbiddenException('Insufficient permissions')
    }
    await this.dataSource.transaction(async (manager) => {
      const asset = await this.getAssetForUpdate(manager, id)
      if (asset.status === dto.status) return
      if (dto.status === 'ASSIGNED') {
        throw new ConflictException(
          'Use the assignment endpoint to set an asset to ASSIGNED',
        )
      }
      const allowed = ASSET_STATUS_TRANSITIONS[asset.status]
      if (!allowed.includes(dto.status)) {
        throw new ConflictException(
          `Asset cannot transition from ${asset.status} to ${dto.status}`,
        )
      }
      const currentAssignments = (await manager.query(
        `SELECT id FROM public.asset_assignments
         WHERE asset_id = $1 AND returned_at IS NULL FOR UPDATE`,
        [id],
      )) as Array<{ id: string }>
      if (currentAssignments.length) {
        throw new ConflictException(
          'Release or reassign the active assignment before changing status',
        )
      }
      await manager.query(
        `UPDATE public.assets
         SET status = $2, updated_by = $3, updated_at = now()
         WHERE id = $1`,
        [id, dto.status, user.id],
      )
      await this.insertStatusHistory(
        manager,
        id,
        asset.status,
        dto.status,
        user.id,
        clean(dto.reason) ?? 'Status changed',
      )
      await writeAuditLog(
        manager,
        request,
        user.id,
        'assets.status_changed',
        'asset',
        id,
        { status: asset.status },
        { status: dto.status, reason: clean(dto.reason) },
      )
    })
    return this.get(id, user)
  }

  async assign(
    id: string,
    dto: AssignAssetDto,
    user: AuthenticatedUser,
    request: Request,
  ): Promise<AssetResponse> {
    await this.dataSource.transaction(async (manager) => {
      const asset = await this.getAssetForUpdate(manager, id)
      const users = (await manager.query(
        `SELECT id FROM public.users
         WHERE id = $1 AND is_active = true AND deleted_at IS NULL
         FOR SHARE`,
        [dto.userId],
      )) as Array<{ id: string }>
      if (!users[0]) {
        throw new ConflictException('Assignment target must be an active user')
      }

      const active = (await manager.query(
        `SELECT id, user_id FROM public.asset_assignments
         WHERE asset_id = $1 AND returned_at IS NULL FOR UPDATE`,
        [id],
      )) as Array<{ id: string; user_id: string }>
      if (asset.status === 'RETIRED' || asset.status === 'DISPOSED') {
        throw new ConflictException(
          `A ${asset.status.toLowerCase()} asset cannot be assigned`,
        )
      }

      if (active.length && asset.status !== 'ASSIGNED') {
        throw new ConflictException(
          'Asset assignment history is inconsistent with its status',
        )
      }
      if (asset.status === 'ASSIGNED' && active.length === 0) {
        throw new ConflictException(
          'Asset status is assigned but no active assignment exists',
        )
      }
      if (active[0]?.user_id === dto.userId) {
        throw new ConflictException('Asset is already assigned to this user')
      }
      if (asset.status !== 'AVAILABLE' && active.length === 0) {
        throw new ConflictException('Only available assets can be assigned')
      }

      const previousUserId = active[0]?.user_id ?? null
      if (active[0]) {
        await manager.query(
          `UPDATE public.asset_assignments
           SET returned_at = now()
           WHERE id = $1`,
          [active[0].id],
        )
      }
      await manager.query(
        `INSERT INTO public.asset_assignments
           (asset_id, user_id, assigned_by, location_id, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, dto.userId, user.id, asset.location_id, clean(dto.notes)],
      )
      if (asset.status !== 'ASSIGNED') {
        await manager.query(
          `UPDATE public.assets
           SET status = 'ASSIGNED', updated_by = $2, updated_at = now()
           WHERE id = $1`,
          [id, user.id],
        )
        await this.insertStatusHistory(
          manager,
          id,
          asset.status,
          'ASSIGNED',
          user.id,
          'Asset assigned',
        )
      }
      await writeAuditLog(
        manager,
        request,
        user.id,
        active[0] ? 'assets.assignment_reassigned' : 'assets.assigned',
        'asset',
        id,
        { assignedUserId: previousUserId },
        { assignedUserId: dto.userId },
      )
    })
    return this.get(id, user)
  }

  async release(
    id: string,
    user: AuthenticatedUser,
    request: Request,
  ): Promise<AssetResponse> {
    await this.dataSource.transaction(async (manager) => {
      const asset = await this.getAssetForUpdate(manager, id)
      const active = (await manager.query(
        `SELECT id, user_id FROM public.asset_assignments
         WHERE asset_id = $1 AND returned_at IS NULL FOR UPDATE`,
        [id],
      )) as Array<{ id: string; user_id: string }>
      if (!active[0])
        throw new ConflictException('Asset has no active assignment')
      if (asset.status !== 'ASSIGNED') {
        throw new ConflictException(
          'Asset assignment history is inconsistent with its status',
        )
      }
      await manager.query(
        `UPDATE public.asset_assignments SET returned_at = now() WHERE id = $1`,
        [active[0].id],
      )
      await manager.query(
        `UPDATE public.assets
         SET status = 'AVAILABLE', updated_by = $2, updated_at = now()
         WHERE id = $1`,
        [id, user.id],
      )
      await this.insertStatusHistory(
        manager,
        id,
        'ASSIGNED',
        'AVAILABLE',
        user.id,
        'Assignment released',
      )
      await writeAuditLog(
        manager,
        request,
        user.id,
        'assets.assignment_released',
        'asset',
        id,
        { assignedUserId: active[0].user_id, status: 'ASSIGNED' },
        { assignedUserId: null, status: 'AVAILABLE' },
      )
    })
    return this.get(id, user)
  }

  async assignments(
    id: string,
    user: AuthenticatedUser,
  ): Promise<Array<Record<string, unknown>>> {
    await this.get(id, user)
    const rows = (await this.dataSource.query(
      `SELECT aa.id, aa.user_id, aa.assigned_by, aa.assigned_at,
              aa.returned_at, aa.notes, aa.location_id, l.name AS location_name,
              u.full_name AS user_name, u.employee_code
       FROM public.asset_assignments aa
       LEFT JOIN public.locations l ON l.id = aa.location_id
       LEFT JOIN public.users u ON u.id = aa.user_id
       WHERE aa.asset_id = $1
       ORDER BY aa.assigned_at DESC, aa.id`,
      [id],
    )) as Array<{
      id: string
      user_id: string
      assigned_by: string | null
      assigned_at: Date
      returned_at: Date | null
      notes: string | null
      location_id: string | null
      location_name: string | null
      user_name: string | null
      employee_code: string | null
    }>
    return rows.map((row) => ({
      id: row.id,
      assignedAt: row.assigned_at,
      returnedAt: row.returned_at,
      notes: row.notes,
      location: row.location_id
        ? { id: row.location_id, name: row.location_name }
        : null,
      assignedUser:
        canViewAssignee(user) || row.user_id === user.id
          ? {
              id: row.user_id,
              fullName: row.user_name,
              employeeCode: row.employee_code,
            }
          : null,
      assignedBy: canViewAssignee(user) ? row.assigned_by : null,
    }))
  }

  async history(
    id: string,
    user: AuthenticatedUser,
  ): Promise<Array<Record<string, unknown>>> {
    await this.get(id, user)
    const statuses = (await this.dataSource.query(
      `SELECT id, 'asset.status_changed' AS action,
              previous_status AS old_values, new_status AS new_values,
              changed_by AS actor_id, reason, changed_at AS created_at
       FROM public.asset_status_history
       WHERE asset_id = $1`,
      [id],
    )) as Array<{
      id: string
      action: string
      old_values: string | null
      new_values: string
      actor_id: string | null
      reason: string | null
      created_at: Date
    }>
    const audit = (await this.dataSource.query(
      `SELECT id, action, old_values, new_values, actor_id, created_at
       FROM public.audit_logs
       WHERE entity_type = 'asset' AND entity_id = $1
         AND action <> 'assets.status_changed'
       ORDER BY created_at DESC`,
      [id],
    )) as Array<{
      id: string
      action: string
      old_values: Record<string, unknown> | null
      new_values: Record<string, unknown> | null
      actor_id: string | null
      created_at: Date
    }>
    return [
      ...statuses.map((row) => ({
        id: row.id,
        action: row.action,
        oldValues: row.old_values ? { status: row.old_values } : null,
        newValues: { status: row.new_values, reason: row.reason },
        actorId: row.actor_id,
        createdAt: row.created_at,
      })),
      ...audit.map((row) => ({
        id: row.id,
        action: row.action,
        oldValues: canViewAssignee(user)
          ? row.old_values
          : redactAssigneeIds(row.old_values),
        newValues: canViewAssignee(user)
          ? row.new_values
          : redactAssigneeIds(row.new_values),
        actorId: row.actor_id,
        createdAt: row.created_at,
      })),
    ].sort(
      (left, right) =>
        new Date(String(right.createdAt)).getTime() -
        new Date(String(left.createdAt)).getTime(),
    )
  }

  private async assertActiveCategory(
    manager: EntityManager,
    id: string,
  ): Promise<void> {
    const rows = (await manager.query(
      `SELECT 1 FROM public.asset_categories
       WHERE id = $1 AND is_active = true FOR SHARE`,
      [id],
    )) as Array<{ '?column?': number }>
    if (!rows[0]) throw new ConflictException('Category is not active')
  }

  private async insertAsset(
    manager: EntityManager,
    dto: CreateAssetDto,
    user: AuthenticatedUser,
    request: Request,
  ): Promise<string> {
    await this.assertActiveCategory(manager, dto.categoryId)
    if (dto.locationId) {
      await this.assertActiveLocation(manager, dto.locationId)
    }
    const rows = (await manager.query(
      `INSERT INTO public.assets
         (asset_tag, name, category_id, manufacturer, model, serial_number,
          description, status, condition, location_id, purchase_date,
          purchase_cost, warranty_start, warranty_end, notes,
          created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'AVAILABLE', 'GOOD',
               $8, $9, $10, $11, $12, $13, $14, $14)
       RETURNING id`,
      [
        dto.assetTag.trim(),
        dto.name.trim(),
        dto.categoryId,
        clean(dto.manufacturer),
        clean(dto.model),
        clean(dto.serialNumber),
        clean(dto.description),
        dto.locationId ?? null,
        dto.purchaseDate ?? null,
        dto.purchaseCost ?? null,
        dto.warrantyStart ?? null,
        dto.warrantyEnd ?? null,
        clean(dto.notes),
        user.id,
      ],
    )) as Array<{ id: string }>
    const id = rows[0].id
    await this.insertStatusHistory(
      manager,
      id,
      null,
      'AVAILABLE',
      user.id,
      'Asset created',
    )
    await writeAuditLog(
      manager,
      request,
      user.id,
      'assets.created',
      'asset',
      id,
      null,
      {
        assetTag: dto.assetTag.trim(),
        name: dto.name.trim(),
        categoryId: dto.categoryId,
        locationId: dto.locationId ?? null,
        status: 'AVAILABLE',
      },
    )
    return id
  }

  private async validateCsvImport(
    manager: EntityManager,
    parsed: ParsedAssetCsv,
  ): Promise<{
    preview: AssetCsvPreview
    categories: Map<string, string>
    locations: Map<string, string>
  }> {
    const categoryCodes = [
      ...new Set(
        parsed.rows
          .map((row) => row.values.categoryCode.toUpperCase())
          .filter(Boolean),
      ),
    ]
    const locationCodes = [
      ...new Set(
        parsed.rows
          .map((row) => row.values.locationCode.toUpperCase())
          .filter(Boolean),
      ),
    ]
    const assetTags = [
      ...new Set(parsed.rows.map((row) => row.values.assetTag)),
    ]
    const serialNumbers = [
      ...new Set(
        parsed.rows.map((row) => row.values.serialNumber).filter(Boolean),
      ),
    ]
    const categoryRows = (await manager.query(
      `SELECT id, code FROM public.asset_categories
       WHERE code = ANY($1::text[]) AND is_active = true FOR SHARE`,
      [categoryCodes],
    )) as Array<{ id: string; code: string }>
    const locationRows = (await manager.query(
      `SELECT id, code FROM public.locations
       WHERE code = ANY($1::text[]) AND is_active = true FOR SHARE`,
      [locationCodes],
    )) as Array<{ id: string; code: string }>
    const existingRows = (await manager.query(
      `SELECT asset_tag, serial_number FROM public.assets
       WHERE asset_tag = ANY($1::text[])
          OR (deleted_at IS NULL AND serial_number = ANY($2::text[]))
       FOR SHARE`,
      [assetTags, serialNumbers],
    )) as Array<{ asset_tag: string; serial_number: string | null }>
    const categories = new Map(
      categoryRows.map((row) => [row.code.toUpperCase(), row.id]),
    )
    const locations = new Map(
      locationRows.map((row) => [row.code.toUpperCase(), row.id]),
    )
    const preview = validateAssetCsv(parsed, {
      categories,
      locations,
      existingAssetTags: new Set(existingRows.map((row) => row.asset_tag)),
      existingSerialNumbers: new Set(
        existingRows
          .map((row) => row.serial_number)
          .filter((value): value is string => value !== null),
      ),
    })
    return { preview, categories, locations }
  }

  private async assertActiveLocation(
    manager: EntityManager,
    id: string,
  ): Promise<void> {
    const rows = (await manager.query(
      `SELECT 1 FROM public.locations
       WHERE id = $1 AND is_active = true FOR SHARE`,
      [id],
    )) as Array<{ '?column?': number }>
    if (!rows[0]) throw new ConflictException('Location is not active')
  }

  private async getAssetForUpdate(
    manager: EntityManager,
    id: string,
  ): Promise<AssetForUpdate> {
    const rows = (await manager.query(
      `SELECT id, is_shared, asset_tag, name, category_id, manufacturer, model,
              serial_number, description, status, condition, purchase_date,
              purchase_cost, warranty_start, warranty_end, location_id, notes
       FROM public.assets
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [id],
    )) as AssetForUpdate[]
    if (!rows[0]) throw new NotFoundException('Asset not found')
    return rows[0]
  }

  private async insertStatusHistory(
    manager: EntityManager,
    assetId: string,
    oldStatus: AssetStatus | null,
    newStatus: AssetStatus,
    actorId: string,
    reason: string,
  ): Promise<void> {
    await manager.query(
      `INSERT INTO public.asset_status_history
         (asset_id, previous_status, new_status, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [assetId, oldStatus, newStatus, actorId, reason],
    )
  }
}

function assetSelect(): string {
  return `SELECT a.id, a.asset_code, a.is_shared, a.asset_tag, a.name, a.category_id,
                 c.code AS category_code, c.name AS category_name,
                 a.manufacturer, a.model, a.serial_number, a.description,
                 a.status, a.condition, a.purchase_date, a.purchase_cost,
                 a.warranty_start, a.warranty_end, a.location_id,
                 l.code AS location_code, l.name AS location_name, a.notes,
                 a.created_at, a.updated_at, aa.user_id AS assigned_user_id,
                 u.full_name AS assigned_user_name,
                 u.employee_code AS assigned_user_employee_code
          FROM public.assets a
          JOIN public.asset_categories c ON c.id = a.category_id
          LEFT JOIN public.locations l ON l.id = a.location_id
          LEFT JOIN public.asset_assignments aa
            ON aa.asset_id = a.id AND aa.returned_at IS NULL
          LEFT JOIN public.users u ON u.id = aa.user_id`
}

function toAssetResponse(
  row: AssetRow,
  includeAssignee: boolean,
): AssetResponse {
  const response: AssetResponse = {
    id: row.id,
    assetCode: row.asset_code,
    isShared: row.is_shared,
    assetTag: row.asset_tag,
    name: row.name,
    category: {
      id: row.category_id,
      code: row.category_code,
      name: row.category_name,
    },
    manufacturer: row.manufacturer,
    model: row.model,
    serialNumber: row.serial_number,
    description: row.description,
    status: row.status,
    condition: row.condition,
    purchaseDate: row.purchase_date,
    purchaseCost: row.purchase_cost,
    warrantyStart: row.warranty_start,
    warrantyEnd: row.warranty_end,
    location: row.location_id
      ? {
          id: row.location_id,
          code: row.location_code ?? '',
          name: row.location_name ?? '',
        }
      : null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
  if (includeAssignee) {
    response.assignedUser = row.assigned_user_id
      ? {
          id: row.assigned_user_id,
          fullName: row.assigned_user_name ?? '',
          employeeCode: row.assigned_user_employee_code,
        }
      : null
  }
  return response
}

function hasAllAssetRead(user: AuthenticatedUser): boolean {
  return (
    user.permissions.includes('assets.read.all') ||
    user.roles.includes('ADMIN') ||
    user.roles.includes('AUDIT') ||
    user.permissions.includes('assets.update')
  )
}

function canViewAssignee(user: AuthenticatedUser): boolean {
  return (
    user.roles.includes('ADMIN') ||
    user.permissions.includes('assets.update') ||
    user.permissions.includes('assets.assign')
  )
}

function mergeAsset(old: AssetForUpdate, dto: UpdateAssetDto): AssetForUpdate {
  const next: AssetForUpdate = { ...old }
  if (dto.assetTag !== undefined) next.asset_tag = dto.assetTag.trim()
  if (dto.name !== undefined) next.name = dto.name.trim()
  if (dto.categoryId !== undefined) next.category_id = dto.categoryId
  if (dto.manufacturer !== undefined) {
    next.manufacturer = clean(dto.manufacturer)
  }
  if (dto.model !== undefined) next.model = clean(dto.model)
  if (dto.serialNumber !== undefined) {
    next.serial_number = clean(dto.serialNumber)
  }
  if (dto.description !== undefined) next.description = clean(dto.description)
  if (dto.locationId !== undefined) next.location_id = dto.locationId
  if (dto.purchaseDate !== undefined) next.purchase_date = dto.purchaseDate
  if (dto.purchaseCost !== undefined) {
    next.purchase_cost =
      dto.purchaseCost === null ? null : String(dto.purchaseCost)
  }
  if (dto.warrantyStart !== undefined) {
    next.warranty_start = dto.warrantyStart
  }
  if (dto.warrantyEnd !== undefined) next.warranty_end = dto.warrantyEnd
  if (dto.notes !== undefined) next.notes = clean(dto.notes)
  return next
}

function changedFields(
  first: AssetForUpdate,
  second: AssetForUpdate,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const field of [
    'is_shared',
    'asset_tag',
    'name',
    'category_id',
    'manufacturer',
    'model',
    'serial_number',
    'description',
    'location_id',
    'purchase_date',
    'purchase_cost',
    'warranty_start',
    'warranty_end',
    'notes',
  ] as const) {
    if (first[field] !== second[field]) {
      result[field] = first[field]
    }
  }
  return result
}

function assertWarrantyRange(
  start: string | null | undefined,
  end: string | null | undefined,
): void {
  if (start && end && end < start) {
    throw new ConflictException(
      'Warranty end date must not precede warranty start date',
    )
  }
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function redactAssigneeIds(
  values: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!values) return values
  const redacted = { ...values }
  delete redacted.assignedUserId
  return redacted
}

function assetCsvRowToDto(
  row: ParsedAssetCsv['rows'][number],
  categoryId: string,
  locationId: string | undefined,
): CreateAssetDto {
  const value = row.values
  const purchaseCost = value.purchaseCost
    ? Number(value.purchaseCost)
    : undefined
  return {
    assetTag: value.assetTag,
    name: value.name,
    categoryId,
    manufacturer: value.manufacturer || undefined,
    model: value.model || undefined,
    serialNumber: value.serialNumber || undefined,
    description: value.description || undefined,
    locationId,
    purchaseDate: value.purchaseDate || undefined,
    purchaseCost,
    warrantyStart: value.warrantyStart || undefined,
    warrantyEnd: value.warrantyEnd || undefined,
    notes: value.notes || undefined,
  }
}

function safeFilename(filename: string): string {
  const withoutControls = basename(filename)
    .split('')
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code > 0x1f && code !== 0x7f
    })
    .join('')
  return withoutControls.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}
