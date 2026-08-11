import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Conversation } from './entities/conversation.entity'
import { Message } from './entities/message.entity'
import { MemoryEntry } from './entities/memory-entry.entity'
import { MemoryService } from './memory.service'
import { MemoryExtractorService } from './memory-extractor.service'
import { VectorMemoryModule } from '../vector-memory/vector-memory.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, MemoryEntry]),
    VectorMemoryModule
  ],
  providers: [MemoryService, MemoryExtractorService],
  exports: [MemoryService, MemoryExtractorService]
})
export class MemoryModule {}
