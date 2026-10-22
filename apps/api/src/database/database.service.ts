import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name)

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.checkConnection()
  }

  async checkConnection(): Promise<boolean> {
    try {
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize()
      }
      await this.dataSource.query('SELECT 1')
      return true
    } catch (error) {
      this.logger.warn(
        `PostgreSQL readiness check failed (code: ${getErrorCode(error)})`,
      )
      return false
    }
  }
}

function getErrorCode(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code
  }

  return 'unknown'
}
