import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { SessionGuard } from '../../common/guards/session.guard'
import { AuditQueryDto } from './dto/audit-query.dto'
import { AuditService } from './audit.service'

@Controller('audit-logs')
@UseGuards(SessionGuard, PermissionsGuard)
@RequirePermissions('audit.read')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() query: AuditQueryDto) {
    return this.audit.list(query)
  }
}
