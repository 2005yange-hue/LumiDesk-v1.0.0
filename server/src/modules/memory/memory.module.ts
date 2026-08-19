import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Conversation } from './entities/conversation.entity'
import { Message } from './entities/message.entity'
import { MemoryEntry } from './entities/memory-entry.entity'
import { MemorySource } from './entities/memory-source.entity'
import { MemoryService } from './memory.service'
import { MemoryExtractorService } from './memory-extractor.service'
import { VectorMemoryModule } from '../vector-memory/vector-memory.module'
import { CharacterModule } from '../character/character.module'
import { MemoryController } from './memory.controller'
import { MemoryDeduplicationService } from './memory-deduplication.service'
import { MemoryScoringService } from './memory-scoring.service'
import { MemoryMaintenanceService } from './memory-maintenance.service'
import { ProactiveAgentModule } from '../proactive-agent/proactive-agent.module'
import { MemoryEvent } from '../proactive-agent/entities/memory-event.entity'
import { Notification } from '../proactive-agent/entities/notification.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, MemoryEntry, MemorySource, MemoryEvent, Notification]),
    VectorMemoryModule,
    CharacterModule,
    ProactiveAgentModule
  ],
  controllers: [MemoryController],
  providers: [
    MemoryService,
    MemoryExtractorService,
    MemoryDeduplicationService,
    MemoryScoringService,
    MemoryMaintenanceService
  ],
  exports: [MemoryService, MemoryExtractorService]
})
export class MemoryModule {}
