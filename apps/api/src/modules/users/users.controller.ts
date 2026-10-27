import {
  ConflictException,
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
import { CreateUserDto } from './dto/create-user.dto'
import { ListUsersDto } from './dto/list-users.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UserRoleDto } from './dto/user-role.dto'
import { UserStatusDto } from './dto/user-status.dto'
import { UsersService } from './users.service'

@Controller('users')
@UseGuards(SessionGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('users.read')
  list(
    @Query() query: ListUsersDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.users.list(
      query,
      currentUser.permissions.includes('users.update'),
    )
  }

  @Get('directory')
  @RequirePermissions('users.directory.read')
  directory(@Query() query: ListUsersDto) {
    return this.users.directory(query)
  }

  @Get(':id')
  @RequirePermissions('users.read')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.users.get(id, currentUser.permissions.includes('users.update'))
  }

  @Post()
  @UseGuards(OriginGuard)
  @RequirePermissions('users.create')
  create(
    @Body() body: CreateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.users.create(body, currentUser.id, request)
  }

  @Patch(':id')
  @UseGuards(OriginGuard)
  @RequirePermissions('users.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.users.update(id, body, currentUser.id, request)
  }

  @Patch(':id/status')
  @UseGuards(OriginGuard)
  @RequirePermissions('users.deactivate')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UserStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Req() request: Request,
  ) {
    if (id === currentUser.id && !body.isActive) {
      throw new ConflictException('You cannot deactivate your own account')
    }
    return this.users.setStatus(id, body, currentUser.id, request)
  }

  @Patch(':id/role')
  @UseGuards(OriginGuard)
  @RequirePermissions('roles.manage')
  setRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UserRoleDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.users.setRole(id, body, currentUser.id, request)
  }
}
