import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module'
import { AuthModule } from '../auth/auth.module'
import { AssetCatalogModule } from '../asset-catalog/asset-catalog.module'
import { AssetsController } from './assets.controller'
import { AssetsService } from './assets.service'

@Module({
  imports: [DatabaseModule, AuthModule, AssetCatalogModule],
  controllers: [AssetsController],
  providers: [AssetsService],
})
export class AssetsModule {}
