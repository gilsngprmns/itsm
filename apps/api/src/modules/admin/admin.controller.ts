import { Controller, Get, UseGuards } from '@nestjs/common'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { SessionGuard } from '../../common/guards/session.guard'

@Controller('admin')
@UseGuards(SessionGuard, PermissionsGuard)
export class AdminController {
  @Get('access-check')
  @RequirePermissions('users.read')
  checkAccess(): { access: 'granted' } {
    return { access: 'granted' }
  }
}
