import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator'
import { OriginGuard } from '../../common/guards/origin.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { SessionGuard } from '../../common/guards/session.guard'
import type { AuthenticatedUser } from '../auth/auth.types'
import { AssignTicketDto } from './dto/assign-ticket.dto'
import { CreateCommentDto } from './dto/create-comment.dto'
import { CreateTicketDto } from './dto/create-ticket.dto'
import { ListTicketsDto } from './dto/list-tickets.dto'
import {
  CreateTicketCategoryDto,
  TicketCategoryStatusDto,
  UpdateTicketCategoryDto,
} from './dto/ticket-category.dto'
import { TicketStatusDto } from './dto/ticket-status.dto'
import { UpdateTicketDto } from './dto/update-ticket.dto'
import { TicketsService } from './tickets.service'

@Controller('tickets')
@UseGuards(SessionGuard, PermissionsGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  @RequireAnyPermissions('tickets.read.all', 'tickets.read.own')
  list(@Query() query: ListTicketsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tickets.list(query, user)
  }

  @Post()
  @UseGuards(OriginGuard)
  @RequirePermissions('tickets.create')
  create(
    @Body() body: CreateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.tickets.create(body, user, request)
  }

  @Get('assignees')
  @RequirePermissions('tickets.assign')
  listAssignees() {
    return this.tickets.listAssignees()
  }

  @Get(':id/comments')
  @RequireAnyPermissions('tickets.read.all', 'tickets.read.own')
  comments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tickets.comments(id, user)
  }

  @Post(':id/comments')
  @UseGuards(OriginGuard)
  @RequirePermissions('tickets.comment')
  @HttpCode(204)
  addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.tickets.addComment(id, body, user, request)
  }

  @Get(':id/history')
  @RequireAnyPermissions('tickets.read.all', 'tickets.read.own')
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tickets.history(id, user)
  }

  @Patch(':id/status')
  @UseGuards(OriginGuard)
  @RequirePermissions('tickets.update')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TicketStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.tickets.setStatus(id, body, user, request)
  }

  @Patch(':id/assignment')
  @UseGuards(OriginGuard)
  @RequirePermissions('tickets.assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignTicketDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.tickets.assign(id, body, user, request)
  }

  @Patch(':id')
  @UseGuards(OriginGuard)
  @RequirePermissions('tickets.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.tickets.update(id, body, user, request)
  }

  @Get(':id')
  @RequireAnyPermissions('tickets.read.all', 'tickets.read.own')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tickets.get(id, user)
  }
}

@Controller('ticket-categories')
@UseGuards(SessionGuard, PermissionsGuard)
export class TicketCategoriesController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  @RequireAnyPermissions('tickets.read.all', 'tickets.read.own')
  list(
    @Query('includeInactive') includeInactive: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const include = includeInactive === 'true'
    if (include && !user.permissions.includes('tickets.update')) {
      return this.tickets.listCategories(false)
    }
    return this.tickets.listCategories(include)
  }

  @Post()
  @UseGuards(OriginGuard)
  @RequirePermissions('tickets.update')
  create(
    @Body() body: CreateTicketCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.tickets.createCategory(body, user, request)
  }

  @Patch(':id/status')
  @UseGuards(OriginGuard)
  @RequirePermissions('tickets.update')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TicketCategoryStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.tickets.setCategoryStatus(id, body, user, request)
  }

  @Patch(':id')
  @UseGuards(OriginGuard)
  @RequirePermissions('tickets.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTicketCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.tickets.updateCategory(id, body, user, request)
  }
}
