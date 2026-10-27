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
import type { CreateDepartmentDto } from './dto/create-department.dto'
import type { CreateLocationDto } from './dto/create-location.dto'
import type { CreateVendorDto } from './dto/create-vendor.dto'
import type { UpdateCategoryDto } from './dto/update-category.dto'
import type { UpdateDepartmentDto } from './dto/update-department.dto'
import type { UpdateLocationDto } from './dto/update-location.dto'
import type { UpdateVendorDto } from './dto/update-vendor.dto'

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

interface DepartmentRow {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
  member_count: number | string
  created_at: Date
  updated_at: Date
}

interface VendorRow {
  id: string
  name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  address: string | null
  website: string | null
  notes: string | null
  reference_count: number | string
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

export interface DepartmentResponse {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  memberCount: number
  createdAt: Date
  updatedAt: Date
}

export interface VendorResponse {
  id: string
  name: string
  contactPerson: string | null
  email: string | null
  phone: string | null
  address: string | null
  website: string | null
  notes: string | null
  referenceCount: number
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

  async listDepartments(): Promise<DepartmentResponse[]> {
    const rows = (await this.dataSource.query(
      `SELECT d.id, d.code, d.name, d.description, d.is_active,
              d.created_at, d.updated_at,
              (SELECT count(*) FROM public.users u
               WHERE u.department_id = d.id
                 AND u.deleted_at IS NULL AND u.is_active = true) AS member_count
       FROM public.departments d ORDER BY d.name, d.id`,
    )) as DepartmentRow[]
    return rows.map(toDepartmentResponse)
  }

  async createDepartment(
    dto: CreateDepartmentDto,
    actorId: string,
    request: Request,
  ): Promise<DepartmentResponse> {
    const code = dto.code.trim().toUpperCase()
    const name = dto.name.trim()
    if (!code || !name) {
      throw new BadRequestException('Department code and name are required')
    }
    try {
      const id = await this.dataSource.transaction(async (manager) => {
        const rows = (await manager.query(
          `INSERT INTO public.departments (code, name, description)
           VALUES ($1, $2, $3) RETURNING id`,
          [code, name, clean(dto.description)],
        )) as Array<{ id: string }>
        await writeAuditLog(
          manager,
          request,
          actorId,
          'departments.created',
          'department',
          rows[0].id,
          null,
          { code, name },
        )
        return rows[0].id
      })
      return toDepartmentResponse(await this.getDepartment(id))
    } catch (error) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException('Department code already exists')
      }
      throw error
    }
  }

  async updateDepartment(
    id: string,
    dto: UpdateDepartmentDto,
    actorId: string,
    request: Request,
  ): Promise<DepartmentResponse> {
    await this.dataSource.transaction(async (manager) => {
      const rows = (await manager.query(
        `SELECT code, name, description, is_active
         FROM public.departments WHERE id = $1 FOR UPDATE`,
        [id],
      )) as Array<{
        code: string
        name: string
        description: string | null
        is_active: boolean
      }>
      const old = rows[0]
      if (!old) throw new NotFoundException('Department not found')
      const name = dto.name?.trim() ?? old.name
      if (!name) throw new BadRequestException('Department name is required')
      const next = {
        name,
        description:
          dto.description === undefined
            ? old.description
            : clean(dto.description),
        isActive: dto.isActive ?? old.is_active,
      }
      if (
        next.name === old.name &&
        next.description === old.description &&
        next.isActive === old.is_active
      ) {
        return
      }
      await manager.query(
        `UPDATE public.departments
         SET name = $2, description = $3, is_active = $4, updated_at = now()
         WHERE id = $1`,
        [id, next.name, next.description, next.isActive],
      )
      await writeAuditLog(
        manager,
        request,
        actorId,
        next.isActive === old.is_active
          ? 'departments.updated'
          : 'departments.status_changed',
        'department',
        id,
        old,
        next,
      )
    })
    return toDepartmentResponse(await this.getDepartment(id))
  }

  async listVendors(): Promise<VendorResponse[]> {
    const rows = (await this.dataSource.query(
      `SELECT v.id, v.name, v.contact_person, v.email, v.phone, v.address,
              v.website, v.notes, v.created_at, v.updated_at,
              (SELECT count(*) FROM public.assets a
               WHERE a.vendor_id = v.id) +
              (SELECT count(*) FROM public.asset_maintenance m
               WHERE m.vendor_id = v.id) AS reference_count
       FROM public.vendors v ORDER BY v.name, v.id`,
    )) as VendorRow[]
    return rows.map(toVendorResponse)
  }

  async createVendor(
    dto: CreateVendorDto,
    actorId: string,
    request: Request,
  ): Promise<VendorResponse> {
    const name = dto.name.trim()
    if (!name) throw new BadRequestException('Vendor name is required')
    const id = await this.dataSource.transaction(async (manager) => {
      const rows = (await manager.query(
        `INSERT INTO public.vendors
           (name, contact_person, email, phone, address, website, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          name,
          clean(dto.contactPerson),
          clean(dto.email)?.toLowerCase() ?? null,
          clean(dto.phone),
          clean(dto.address),
          clean(dto.website),
          clean(dto.notes),
        ],
      )) as Array<{ id: string }>
      await writeAuditLog(
        manager,
        request,
        actorId,
        'vendors.created',
        'vendor',
        rows[0].id,
        null,
        { name },
      )
      return rows[0].id
    })
    return toVendorResponse(await this.getVendor(id))
  }

  async updateVendor(
    id: string,
    dto: UpdateVendorDto,
    actorId: string,
    request: Request,
  ): Promise<VendorResponse> {
    await this.dataSource.transaction(async (manager) => {
      const rows = (await manager.query(
        `SELECT name, contact_person, email, phone, address, website, notes
         FROM public.vendors WHERE id = $1 FOR UPDATE`,
        [id],
      )) as Array<{
        name: string
        contact_person: string | null
        email: string | null
        phone: string | null
        address: string | null
        website: string | null
        notes: string | null
      }>
      const old = rows[0]
      if (!old) throw new NotFoundException('Vendor not found')
      const next = {
        name: dto.name?.trim() ?? old.name,
        contactPerson:
          dto.contactPerson === undefined
            ? old.contact_person
            : clean(dto.contactPerson),
        email:
          dto.email === undefined
            ? old.email
            : (clean(dto.email)?.toLowerCase() ?? null),
        phone: dto.phone === undefined ? old.phone : clean(dto.phone),
        address: dto.address === undefined ? old.address : clean(dto.address),
        website: dto.website === undefined ? old.website : clean(dto.website),
        notes: dto.notes === undefined ? old.notes : clean(dto.notes),
      }
      if (!next.name) throw new BadRequestException('Vendor name is required')
      if (
        next.name === old.name &&
        next.contactPerson === old.contact_person &&
        next.email === old.email &&
        next.phone === old.phone &&
        next.address === old.address &&
        next.website === old.website &&
        next.notes === old.notes
      ) {
        return
      }
      await manager.query(
        `UPDATE public.vendors
         SET name = $2, contact_person = $3, email = $4, phone = $5,
             address = $6, website = $7, notes = $8, updated_at = now()
         WHERE id = $1`,
        [
          id,
          next.name,
          next.contactPerson,
          next.email,
          next.phone,
          next.address,
          next.website,
          next.notes,
        ],
      )
      await writeAuditLog(
        manager,
        request,
        actorId,
        'vendors.updated',
        'vendor',
        id,
        old,
        next,
      )
    })
    return toVendorResponse(await this.getVendor(id))
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

  private async getDepartment(id: string): Promise<DepartmentRow> {
    const rows = (await this.dataSource.query(
      `SELECT d.id, d.code, d.name, d.description, d.is_active,
              d.created_at, d.updated_at,
              (SELECT count(*) FROM public.users u
               WHERE u.department_id = d.id
                 AND u.deleted_at IS NULL AND u.is_active = true) AS member_count
       FROM public.departments d WHERE d.id = $1`,
      [id],
    )) as DepartmentRow[]
    if (!rows[0]) throw new NotFoundException('Department not found')
    return rows[0]
  }

  private async getVendor(id: string): Promise<VendorRow> {
    const rows = (await this.dataSource.query(
      `SELECT v.id, v.name, v.contact_person, v.email, v.phone, v.address,
              v.website, v.notes, v.created_at, v.updated_at,
              (SELECT count(*) FROM public.assets a
               WHERE a.vendor_id = v.id) +
              (SELECT count(*) FROM public.asset_maintenance m
               WHERE m.vendor_id = v.id) AS reference_count
       FROM public.vendors v WHERE v.id = $1`,
      [id],
    )) as VendorRow[]
    if (!rows[0]) throw new NotFoundException('Vendor not found')
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

function toDepartmentResponse(row: DepartmentRow): DepartmentResponse {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    memberCount: Number(row.member_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toVendorResponse(row: VendorRow): VendorResponse {
  return {
    id: row.id,
    name: row.name,
    contactPerson: row.contact_person,
    email: row.email,
    phone: row.phone,
    address: row.address,
    website: row.website,
    notes: row.notes,
    referenceCount: Number(row.reference_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
