import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module'
import { AuthModule } from '../auth/auth.module'
import {
  TicketCategoriesController,
  TicketsController,
} from './tickets.controller'
import { TicketsService } from './tickets.service'
import { TicketAttachmentStorageService } from './ticket-attachment-storage.service'

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [TicketsController, TicketCategoriesController],
  providers: [TicketsService, TicketAttachmentStorageService],
})
export class TicketsModule {}
