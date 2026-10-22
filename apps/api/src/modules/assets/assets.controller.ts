import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { AssetsService } from './assets.service'
import { AssignAssetDto } from './dto/assign-asset.dto'
import { AssetStatusDto } from './dto/asset-status.dto'
import { CreateAssetDto } from './dto/create-asset.dto'
import { ListAssetsDto } from './dto/list-assets.dto'
import { UpdateAssetDto } from './dto/update-asset.dto'

@Controller('assets')
@UseGuards(SessionGuard, PermissionsGuard)
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  @RequirePermissions('assets.read')
  list(@Query() query: ListAssetsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assets.list(query, user)
  }

  @Get(':id/assignments')
  @RequirePermissions('assets.read')
  assignments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assets.assignments(id, user)
  }

  @Get(':id/history')
  @RequirePermissions('assets.read')
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assets.history(id, user)
  }

  @Get(':id')
  @RequirePermissions('assets.read')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assets.get(id, user)
  }

  @Post()
  @UseGuards(OriginGuard)
  @RequirePermissions('assets.create')
  create(
    @Body() body: CreateAssetDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.assets.create(body, user, request)
  }

  @Patch(':id')
  @UseGuards(OriginGuard)
  @RequirePermissions('assets.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAssetDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.assets.update(id, body, user, request)
  }

  @Patch(':id/status')
  @UseGuards(OriginGuard)
  @RequirePermissions('assets.update')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssetStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.assets.setStatus(id, body, user, request)
  }

  @Post(':id/assignments')
  @UseGuards(OriginGuard)
  @RequirePermissions('assets.assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignAssetDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.assets.assign(id, body, user, request)
  }

  @Post(':id/assignments/release')
  @UseGuards(OriginGuard)
  @RequirePermissions('assets.assign')
  release(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.assets.release(id, user, request)
  }
}
