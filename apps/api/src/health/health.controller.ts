import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'

export interface HealthResponse {
  status: 'ok'
  service: string
  timestamp: string
}

export interface ReadinessResponse {
  status: 'ok' | 'error'
  service: 'api'
  database: 'available' | 'unavailable'
  timestamp?: string
}

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    }
  }

  @Get('ready')
  async readiness(): Promise<ReadinessResponse> {
    if (!(await this.database.checkConnection())) {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'api',
        database: 'unavailable',
      } satisfies ReadinessResponse)
    }

    return {
      status: 'ok',
      service: 'api',
      database: 'available',
      timestamp: new Date().toISOString(),
    }
  }
}
