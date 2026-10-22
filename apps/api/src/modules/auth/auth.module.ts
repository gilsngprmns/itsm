import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DatabaseModule } from '../../database/database.module'
import { OriginGuard } from '../../common/guards/origin.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { SessionGuard } from '../../common/guards/session.guard'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, OriginGuard, SessionGuard, PermissionsGuard],
  exports: [AuthService, SessionGuard, PermissionsGuard, OriginGuard],
})
export class AuthModule {}
