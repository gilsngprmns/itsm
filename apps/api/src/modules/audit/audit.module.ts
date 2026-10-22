import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module'
import { AuthModule } from '../auth/auth.module'
import { AuditController } from './audit.controller'
import { AuditService } from './audit.service'

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AuditController],
  providers: [AuditService],
})
export class AuditModule {}
