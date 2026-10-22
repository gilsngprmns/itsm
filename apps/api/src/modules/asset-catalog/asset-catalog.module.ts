import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module'
import { AuthModule } from '../auth/auth.module'
import { AssetCatalogController } from './asset-catalog.controller'
import { AssetCatalogService } from './asset-catalog.service'

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AssetCatalogController],
  providers: [AssetCatalogService],
  exports: [AssetCatalogService],
})
export class AssetCatalogModule {}
