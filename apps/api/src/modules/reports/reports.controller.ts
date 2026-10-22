import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { SessionGuard } from '../../common/guards/session.guard'
import { ReportsQueryDto } from './dto/reports-query.dto'
import { ReportsService } from './reports.service'

@Controller('reports')
@UseGuards(SessionGuard, PermissionsGuard)
@RequirePermissions('reports.read')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  overview(@Query() query: ReportsQueryDto) {
    return this.reports.overview(query)
  }

  @Get('tickets')
  tickets(@Query() query: ReportsQueryDto) {
    return this.reports.tickets(query)
  }

  @Get('assets')
  assets() {
    return this.reports.assets()
  }

  @Get('activity')
  activity() {
    return this.reports.activity()
  }
}
