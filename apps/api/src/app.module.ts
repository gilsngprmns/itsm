import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { validateEnvironment } from './config/validate-environment'
import { resolveWorkspaceEnvironmentFile } from './config/workspace-environment'
import { DatabaseModule } from './database/database.module'
import { AuthModule } from './modules/auth/auth.module'
import { AdminModule } from './modules/admin/admin.module'
import { UsersModule } from './modules/users/users.module'
import { AssetCatalogModule } from './modules/asset-catalog/asset-catalog.module'
import { AssetsModule } from './modules/assets/assets.module'
import { TicketsModule } from './modules/tickets/tickets.module'
import { AuditModule } from './modules/audit/audit.module'
import { ReportsModule } from './modules/reports/reports.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveWorkspaceEnvironmentFile(__dirname),
      validate: validateEnvironment,
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    AdminModule,
    UsersModule,
    AssetCatalogModule,
    AssetsModule,
    TicketsModule,
    AuditModule,
    ReportsModule,
  ],
})
export class AppModule {}
