import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator'
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

interface UploadedCsvFile {
  originalname: string
  buffer: Buffer
}

@Controller('assets')
@UseGuards(SessionGuard, PermissionsGuard)
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  @RequirePermissions('assets.read')
  list(@Query() query: ListAssetsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assets.list(query, user)
  }

  @Get('import/template')
  @RequirePermissions('assets.create')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="asset-import-template.csv"',
  )
  csvTemplate() {
    return this.assets.csvTemplate()
  }

  @Get('export.csv')
  @RequirePermissions('assets.read.all')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="assets.csv"')
  exportCsv(
    @Query() query: ListAssetsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assets.exportCsv(query, user)
  }

  @Post('import/preview')
  @UseGuards(OriginGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  @RequirePermissions('assets.create')
  previewCsvImport(@UploadedFile() file: UploadedCsvFile | undefined) {
    if (!file) throw new BadRequestException('Choose a CSV file to preview')
    return this.assets.previewCsvImport(file.buffer, file.originalname)
  }

  @Post('import')
  @UseGuards(OriginGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  @RequirePermissions('assets.create')
  importCsv(
    @UploadedFile() file: UploadedCsvFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    if (!file) throw new BadRequestException('Choose a CSV file to import')
    return this.assets.importCsv(file.buffer, file.originalname, user, request)
  }

  @Get('by-code/:code')
  @RequirePermissions('assets.read')
  byCode(@Param('code') code: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assets.byCode(code, user)
  }

  @Get(':id/qr')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @RequirePermissions('assets.read')
  qr(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assets.qr(id, user)
  }

  @Get(':id/tickets')
  @RequireAnyPermissions('tickets.read.all', 'tickets.read.own')
  linkedTickets(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListAssetsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assets.linkedTickets(id, query, user)
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
