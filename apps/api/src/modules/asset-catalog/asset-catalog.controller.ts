import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { OriginGuard } from '../../common/guards/origin.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { SessionGuard } from '../../common/guards/session.guard'
import type { AuthenticatedUser } from '../auth/auth.types'
import { AssetCatalogService } from './asset-catalog.service'
import { CreateCategoryDto } from './dto/create-category.dto'
import { CreateDepartmentDto } from './dto/create-department.dto'
import { CreateLocationDto } from './dto/create-location.dto'
import { CreateVendorDto } from './dto/create-vendor.dto'
import { UpdateCategoryDto } from './dto/update-category.dto'
import { UpdateDepartmentDto } from './dto/update-department.dto'
import { UpdateLocationDto } from './dto/update-location.dto'
import { UpdateVendorDto } from './dto/update-vendor.dto'

@Controller()
@UseGuards(SessionGuard, PermissionsGuard)
export class AssetCatalogController {
  constructor(private readonly catalog: AssetCatalogService) {}

  @Get('asset-categories')
  @RequirePermissions('assets.read')
  categories() {
    return this.catalog.listCategories()
  }

  @Post('asset-categories')
  @UseGuards(OriginGuard)
  @RequirePermissions('assets.update')
  createCategory(
    @Body() body: CreateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.catalog.createCategory(body, user.id, request)
  }

  @Patch('asset-categories/:id')
  @UseGuards(OriginGuard)
  @RequirePermissions('assets.update')
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.catalog.updateCategory(id, body, user.id, request)
  }

  @Get('locations')
  @RequirePermissions('assets.read')
  locations() {
    return this.catalog.listLocations()
  }

  @Post('locations')
  @UseGuards(OriginGuard)
  @RequirePermissions('assets.update')
  createLocation(
    @Body() body: CreateLocationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.catalog.createLocation(body, user.id, request)
  }

  @Patch('locations/:id')
  @UseGuards(OriginGuard)
  @RequirePermissions('assets.update')
  updateLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateLocationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.catalog.updateLocation(id, body, user.id, request)
  }

  @Get('departments')
  @RequirePermissions('assets.read')
  departments() {
    return this.catalog.listDepartments()
  }

  @Post('departments')
  @UseGuards(OriginGuard)
  @RequirePermissions('assets.update')
  createDepartment(
    @Body() body: CreateDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.catalog.createDepartment(body, user.id, request)
  }

  @Patch('departments/:id')
  @UseGuards(OriginGuard)
  @RequirePermissions('assets.update')
  updateDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.catalog.updateDepartment(id, body, user.id, request)
  }

  @Get('vendors')
  @RequirePermissions('assets.read')
  vendors() {
    return this.catalog.listVendors()
  }

  @Post('vendors')
  @UseGuards(OriginGuard)
  @RequirePermissions('assets.update')
  createVendor(
    @Body() body: CreateVendorDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.catalog.createVendor(body, user.id, request)
  }

  @Patch('vendors/:id')
  @UseGuards(OriginGuard)
  @RequirePermissions('assets.update')
  updateVendor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateVendorDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.catalog.updateVendor(id, body, user.id, request)
  }
}
