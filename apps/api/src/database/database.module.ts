import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { createDatabaseOptions } from './database-options'
import { DatabaseService } from './database.service'

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...createDatabaseOptions(config.getOrThrow<string>('DATABASE_URL')),
        autoLoadEntities: true,
        manualInitialization: true,
        retryAttempts: 1,
        retryDelay: 0,
      }),
    }),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService, TypeOrmModule],
})
export class DatabaseModule {}
