import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import * as argon2 from 'argon2'
import type { Request } from 'express'
import { DataSource, type EntityManager } from 'typeorm'
import { getPostgresErrorCode, writeAuditLog } from '../../common/audit-log'
import type { CreateUserDto } from './dto/create-user.dto'
import type { ListUsersDto } from './dto/list-users.dto'
import type { UpdateUserDto } from './dto/update-user.dto'
import type { UserRoleDto } from './dto/user-role.dto'
import type { UserStatusDto } from './dto/user-status.dto'

interface UserRow {
  id: string
  employee_code: string | null
  full_name: string
  email: string
  phone: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
  roles: string[]
}

export interface UserResponse {
  id: string
  fullName: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  roles: string[]
  employeeCode?: string | null
  email?: string
  phone?: string | null
}

const PASSWORD_OPTIONS: argon2.Options & { type: number } = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
}

@Injectable()
export class UsersService {
  constructor(private readonly dataSource: DataSource) {}

  async list(
    query: ListUsersDto,
    includePersonalData: boolean,
  ): Promise<{
    items: UserResponse[]
    page: number
    limit: number
    total: number
  }> {
    const conditions = ['u.deleted_at IS NULL']
    const parameters: unknown[] = []
    const search = query.search?.trim()

    if (search) {
      parameters.push(`%${search}%`)
      const pattern = `$${parameters.length}`
      conditions.push(
        includePersonalData
          ? `(u.full_name ILIKE ${pattern} OR u.employee_code ILIKE ${pattern} OR u.email ILIKE ${pattern})`
          : `(u.full_name ILIKE ${pattern} OR u.employee_code ILIKE ${pattern})`,
      )
    }

    const where = conditions.join(' AND ')
    const countRows = (await this.dataSource.query(
      `SELECT count(*)::int AS total FROM public.users u WHERE ${where}`,
      parameters,
    )) as Array<{ total: number }>

    const page = query.page || 1
    const limit = query.limit || 25
    const offset = (page - 1) * limit
    const rows = (await this.dataSource.query(
      `${userSelect(where)}
       GROUP BY u.id
       ORDER BY u.created_at DESC, u.id
       LIMIT $${parameters.length + 1} OFFSET $${parameters.length + 2}`,
      [...parameters, limit, offset],
    )) as UserRow[]

    return {
      items: rows.map((row) => toUserResponse(row, includePersonalData)),
      page,
      limit,
      total: Number(countRows[0]?.total ?? 0),
    }
  }

  async get(id: string, includePersonalData: boolean): Promise<UserResponse> {
    const rows = (await this.dataSource.query(
      `${userSelect('u.id = $1 AND u.deleted_at IS NULL')} GROUP BY u.id`,
      [id],
    )) as UserRow[]
    if (!rows[0]) throw new NotFoundException('User not found')
    return toUserResponse(rows[0], includePersonalData)
  }

  async create(
    dto: CreateUserDto,
    actorId: string,
    request: Request,
  ): Promise<UserResponse> {
    const fullName = dto.fullName.trim()
    if (!fullName) throw new BadRequestException('Full name is required')
    const passwordHash = await argon2.hash(
      dto.initialPassword,
      PASSWORD_OPTIONS,
    )
    const email = dto.email.trim().toLowerCase()

    try {
      const id = await this.dataSource.transaction(async (manager) => {
        const rows = (await manager.query(
          `INSERT INTO public.users
             (full_name, email, password_hash, employee_code, phone, is_active)
           VALUES ($1, $2, $3, $4, $5, true)
           RETURNING id`,
          [
            fullName,
            email,
            passwordHash,
            cleanOptional(dto.employeeCode),
            cleanOptional(dto.phone),
          ],
        )) as Array<{ id: string }>
        const userId = rows[0].id
        const roles = (await manager.query(
          `SELECT id FROM public.roles WHERE code = 'USER'`,
        )) as Array<{ id: string }>
        if (!roles[0]) {
          throw new NotFoundException('Default USER role was not found')
        }
        await manager.query(
          `INSERT INTO public.user_roles (user_id, role_id, assigned_by)
           VALUES ($1, $2, $3)`,
          [userId, roles[0].id, actorId],
        )
        await writeAuditLog(
          manager,
          request,
          actorId,
          'users.created',
          'user',
          userId,
          null,
          {
            fullName,
            email,
            employeeCode: cleanOptional(dto.employeeCode),
            isActive: true,
          },
        )
        return userId
      })
      return this.get(id, true)
    } catch (error) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException(
          'A user with this email or employee code already exists',
        )
      }
      throw error
    }
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actorId: string,
    request: Request,
  ): Promise<UserResponse> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const old = await getUserForUpdate(manager, id)
        const fullName = dto.fullName?.trim()
        if (fullName === '') {
          throw new BadRequestException('Full name cannot be empty')
        }
        const next = {
          fullName: fullName ?? old.full_name,
          email: dto.email?.trim().toLowerCase() ?? old.email,
          employeeCode:
            dto.employeeCode === undefined
              ? old.employee_code
              : cleanOptional(dto.employeeCode),
          phone: dto.phone === undefined ? old.phone : cleanOptional(dto.phone),
        }
        await manager.query(
          `UPDATE public.users
           SET full_name = $2, email = $3, employee_code = $4, phone = $5,
               updated_at = now()
           WHERE id = $1`,
          [id, next.fullName, next.email, next.employeeCode, next.phone],
        )
        if (
          next.fullName !== old.full_name ||
          next.email !== old.email ||
          next.employeeCode !== old.employee_code ||
          next.phone !== old.phone
        ) {
          await writeAuditLog(
            manager,
            request,
            actorId,
            'users.updated',
            'user',
            id,
            {
              fullName: old.full_name,
              email: old.email,
              employeeCode: old.employee_code,
              phone: old.phone,
            },
            next,
          )
        }
      })
      return this.get(id, true)
    } catch (error) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException(
          'A user with this email or employee code already exists',
        )
      }
      throw error
    }
  }

  async setStatus(
    id: string,
    dto: UserStatusDto,
    actorId: string,
    request: Request,
  ): Promise<UserResponse> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(71034003, 2)')
      const old = await getUserForUpdate(manager, id)
      if (old.is_active === dto.isActive) return

      if (!dto.isActive) {
        const roles = (await manager.query(
          `SELECT 1 FROM public.user_roles ur
           JOIN public.roles r ON r.id = ur.role_id
           WHERE ur.user_id = $1 AND r.code = 'ADMIN'`,
          [id],
        )) as Array<{ '?column?': number }>
        if (roles[0]) await ensureAnotherActiveAdmin(manager, id)
      }
      await manager.query(
        `UPDATE public.users SET is_active = $2, updated_at = now() WHERE id = $1`,
        [id, dto.isActive],
      )
      if (!dto.isActive) {
        await manager.query(
          `UPDATE public.refresh_tokens
           SET revoked_at = now()
           WHERE user_id = $1 AND revoked_at IS NULL`,
          [id],
        )
      }
      await writeAuditLog(
        manager,
        request,
        actorId,
        dto.isActive ? 'users.activated' : 'users.deactivated',
        'user',
        id,
        { isActive: old.is_active },
        { isActive: dto.isActive },
      )
    })
    return this.get(id, true)
  }

  async setRole(
    id: string,
    dto: UserRoleDto,
    actorId: string,
    request: Request,
  ): Promise<UserResponse> {
    if (id === actorId) {
      throw new ConflictException('You cannot change your own role')
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(71034003, 2)')
      await getUserForUpdate(manager, id)
      const existing = (await manager.query(
        `SELECT r.code
         FROM public.user_roles ur
         JOIN public.roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1
         ORDER BY r.code`,
        [id],
      )) as Array<{ code: string }>
      const oldRoles = existing.map((role) => role.code)
      if (oldRoles.length === 1 && oldRoles[0] === dto.roleCode) return
      if (oldRoles.includes('ADMIN') && dto.roleCode !== 'ADMIN') {
        await ensureAnotherActiveAdmin(manager, id)
      }

      const role = (await manager.query(
        `SELECT id FROM public.roles WHERE code = $1`,
        [dto.roleCode],
      )) as Array<{ id: string }>
      if (!role[0]) throw new NotFoundException('Role not found')

      await manager.query(`DELETE FROM public.user_roles WHERE user_id = $1`, [
        id,
      ])
      await manager.query(
        `INSERT INTO public.user_roles (user_id, role_id, assigned_by)
         VALUES ($1, $2, $3)`,
        [id, role[0].id, actorId],
      )
      await writeAuditLog(
        manager,
        request,
        actorId,
        'users.role_changed',
        'user',
        id,
        { roles: oldRoles },
        { roles: [dto.roleCode] },
      )
    })
    return this.get(id, true)
  }
}

async function ensureAnotherActiveAdmin(
  manager: EntityManager,
  userId: string,
): Promise<void> {
  const rows = (await manager.query(
    `SELECT count(*)::int AS count
     FROM public.user_roles ur
     JOIN public.roles r ON r.id = ur.role_id
     JOIN public.users u ON u.id = ur.user_id
     WHERE r.code = 'ADMIN' AND u.is_active = true
       AND u.deleted_at IS NULL AND u.id <> $1`,
    [userId],
  )) as Array<{ count: number }>
  if (Number(rows[0]?.count ?? 0) === 0) {
    throw new ConflictException(
      'At least one other active administrator must remain',
    )
  }
}

async function getUserForUpdate(
  manager: EntityManager,
  id: string,
): Promise<{
  full_name: string
  email: string
  employee_code: string | null
  phone: string | null
  is_active: boolean
}> {
  const rows = (await manager.query(
    `SELECT full_name, email, employee_code, phone, is_active
     FROM public.users
     WHERE id = $1 AND deleted_at IS NULL
     FOR UPDATE`,
    [id],
  )) as Array<{
    full_name: string
    email: string
    employee_code: string | null
    phone: string | null
    is_active: boolean
  }>
  if (!rows[0]) throw new NotFoundException('User not found')
  return rows[0]
}

function userSelect(where: string): string {
  return `SELECT u.id, u.employee_code, u.full_name, u.email, u.phone,
                 u.is_active, u.created_at, u.updated_at,
                 COALESCE(array_agg(DISTINCT r.code::text)
                   FILTER (WHERE r.code IS NOT NULL), ARRAY[]::text[]) AS roles
          FROM public.users u
          LEFT JOIN public.user_roles ur ON ur.user_id = u.id
          LEFT JOIN public.roles r ON r.id = ur.role_id
          WHERE ${where}`
}

function toUserResponse(
  row: UserRow,
  includePersonalData: boolean,
): UserResponse {
  return {
    id: row.id,
    fullName: row.full_name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    roles: row.roles,
    ...(includePersonalData ? { email: row.email, phone: row.phone } : {}),
    ...(includePersonalData ? { employeeCode: row.employee_code } : {}),
  }
}

function cleanOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
