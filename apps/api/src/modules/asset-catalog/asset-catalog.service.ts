import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { Request } from 'express'
import { DataSource } from 'typeorm'
import { getPostgresErrorCode, writeAuditLog } from '../../common/audit-log'
import type { CreateCategoryDto } from './dto/create-category.dto'
import type { CreateLocationDto } from './dto/create-location.dto'
import type { UpdateCategoryDto } from './dto/update-category.dto'
import type { UpdateLocationDto } from './dto/update-location.dto'

interface CategoryRow {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
  created_at: Date
}

interface LocationRow {
  id: string
  code: string
  name: string
  building: string | null
  floor: string | null
  room: string | null
  address: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface CategoryResponse {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: Date
}

export interface LocationResponse {
  id: string
  code: string
  name: string
  building: string | null
  floor: string | null
  room: string | null
  address: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class AssetCatalogService {
  constructor(private readonly dataSource: DataSource) {}

  async listCategories(): Promise<CategoryResponse[]> {
    const rows = (await this.dataSource.query(
      `SELECT id, code, name, description, is_active, created_at
       FROM public.asset_categories ORDER BY name, id`,
    )) as CategoryRow[]
    return rows.map(toCategoryResponse)
  }

  async createCategory(
    dto: CreateCategoryDto,
    actorId: string,
    request: Request,
  ): Promise<CategoryResponse> {
    const code = dto.code.trim().toUpperCase()
    const name = dto.name.trim()
    if (!code || !name) {
      throw new BadRequestException('Category code and name are required')
    }
    try {
      const id = await this.dataSource.transaction(async (manager) => {
        const rows = (await manager.query(
          `INSERT INTO public.asset_categories (code, name, description, is_active)
           VALUES ($1, $2, $3, true) RETURNING id`,
          [code, name, clean(dto.description)],
        )) as Array<{ id: string }>
        await writeAuditLog(
          manager,
          request,
          actorId,
          'asset_categories.created',
          'asset_category',
          rows[0].id,
          null,
          { code, name },
        )
        return rows[0].id
      })
      return toCategoryResponse(await this.getCategory(id))
    } catch (error) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException('Category code already exists')
      }
      throw error
    }
  }

  async updateCategory(
    id: string,
    dto: UpdateCategoryDto,
    actorId: string,
    request: Request,
  ): Promise<CategoryResponse> {
    await this.dataSource.transaction(async (manager) => {
      const old = (await manager.query(
        `SELECT code, name, description, is_active
         FROM public.asset_categories WHERE id = $1 FOR UPDATE`,
        [id],
      )) as Array<{
        code: string
        name: string
        description: string | null
        is_active: boolean
      }>
      if (!old[0]) throw new NotFoundException('Asset category not found')
      const name = dto.name?.trim()
      if (name === '')
        throw new BadRequestException('Category name is required')
      const next = {
        name: name ?? old[0].name,
        description:
          dto.description === undefined
            ? old[0].description
            : clean(dto.description),
        isActive: dto.isActive ?? old[0].is_active,
      }
      if (
        next.name === old[0].name &&
        next.description === old[0].description &&
        next.isActive === old[0].is_active
      ) {
        return
      }
      await manager.query(
        `UPDATE public.asset_categories
         SET name = $2, description = $3, is_active = $4
         WHERE id = $1`,
        [id, next.name, next.description, next.isActive],
      )
      await writeAuditLog(
        manager,
        request,
        actorId,
        next.isActive === old[0].is_active
          ? 'asset_categories.updated'
          : 'asset_categories.status_changed',
        'asset_category',
        id,
        old[0],
        next,
      )
    })
    return toCategoryResponse(await this.getCategory(id))
  }

  async listLocations(): Promise<LocationResponse[]> {
    const rows = (await this.dataSource.query(
      `SELECT id, code, name, building, floor, room, address, is_active,
              created_at, updated_at
       FROM public.locations ORDER BY name, id`,
    )) as LocationRow[]
    return rows.map(toLocationResponse)
  }

  async createLocation(
    dto: CreateLocationDto,
    actorId: string,
    request: Request,
  ): Promise<LocationResponse> {
    const code = dto.code.trim().toUpperCase()
    const name = dto.name.trim()
    if (!code || !name) {
      throw new BadRequestException('Location code and name are required')
    }
    try {
      const id = await this.dataSource.transaction(async (manager) => {
        const rows = (await manager.query(
          `INSERT INTO public.locations
             (code, name, building, floor, room, address, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)
           RETURNING id`,
          [
            code,
            name,
            clean(dto.building),
            clean(dto.floor),
            clean(dto.room),
            clean(dto.address),
          ],
        )) as Array<{ id: string }>
        await writeAuditLog(
          manager,
          request,
          actorId,
          'locations.created',
          'location',
          rows[0].id,
          null,
          { code, name },
        )
        return rows[0].id
      })
      return toLocationResponse(await this.getLocation(id))
    } catch (error) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException('Location code already exists')
      }
      throw error
    }
  }

  async updateLocation(
    id: string,
    dto: UpdateLocationDto,
    actorId: string,
    request: Request,
  ): Promise<LocationResponse> {
    await this.dataSource.transaction(async (manager) => {
      const old = (await manager.query(
        `SELECT code, name, building, floor, room, address, is_active
         FROM public.locations WHERE id = $1 FOR UPDATE`,
        [id],
      )) as Array<{
        code: string
        name: string
        building: string | null
        floor: string | null
        room: string | null
        address: string | null
        is_active: boolean
      }>
      if (!old[0]) throw new NotFoundException('Location not found')
      const name = dto.name?.trim()
      if (name === '')
        throw new BadRequestException('Location name is required')
      const next = {
        name: name ?? old[0].name,
        building:
          dto.building === undefined ? old[0].building : clean(dto.building),
        floor: dto.floor === undefined ? old[0].floor : clean(dto.floor),
        room: dto.room === undefined ? old[0].room : clean(dto.room),
        address:
          dto.address === undefined ? old[0].address : clean(dto.address),
        isActive: dto.isActive ?? old[0].is_active,
      }
      if (
        next.name === old[0].name &&
        next.building === old[0].building &&
        next.floor === old[0].floor &&
        next.room === old[0].room &&
        next.address === old[0].address &&
        next.isActive === old[0].is_active
      ) {
        return
      }
      await manager.query(
        `UPDATE public.locations
         SET name = $2, building = $3, floor = $4, room = $5,
             address = $6, is_active = $7, updated_at = now()
         WHERE id = $1`,
        [
          id,
          next.name,
          next.building,
          next.floor,
          next.room,
          next.address,
          next.isActive,
        ],
      )
      await writeAuditLog(
        manager,
        request,
        actorId,
        'locations.updated',
        'location',
        id,
        old[0],
        next,
      )
    })
    return toLocationResponse(await this.getLocation(id))
  }

  private async getCategory(id: string): Promise<CategoryRow> {
    const rows = (await this.dataSource.query(
      `SELECT id, code, name, description, is_active, created_at
       FROM public.asset_categories WHERE id = $1`,
      [id],
    )) as CategoryRow[]
    if (!rows[0]) throw new NotFoundException('Asset category not found')
    return rows[0]
  }

  private async getLocation(id: string): Promise<LocationRow> {
    const rows = (await this.dataSource.query(
      `SELECT id, code, name, building, floor, room, address, is_active,
              created_at, updated_at
       FROM public.locations WHERE id = $1`,
      [id],
    )) as LocationRow[]
    if (!rows[0]) throw new NotFoundException('Location not found')
    return rows[0]
  }
}

function toCategoryResponse(row: CategoryRow): CategoryResponse {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

function toLocationResponse(row: LocationRow): LocationResponse {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    building: row.building,
    floor: row.floor,
    room: row.room,
    address: row.address,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
