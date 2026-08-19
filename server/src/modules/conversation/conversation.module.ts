import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Conversation } from '../memory/entities/conversation.entity'
import { Message } from '../memory/entities/message.entity'
import { EmotionRecord } from '../emotion/entities/emotion-record.entity'
import { ConversationService } from './conversation.service'
import { ConversationController } from './conversation.controller'
import { ConversationRebuildService } from './conversation-rebuild.service'
import { MemoryModule } from '../memory/memory.module'
import { CharacterStateModule } from '../character-state/character-state.module'
import { ProactiveAgentModule } from '../proactive-agent/proactive-agent.module'
import { ProviderModule } from '../provider/provider.module'
import { VectorMemoryModule } from '../vector-memory/vector-memory.module'
import { CharacterModule } from '../character/character.module'
import { MemoryEntry } from '../memory/entities/memory-entry.entity'
import { MemorySource } from '../memory/entities/memory-source.entity'
import { MemoryEvent } from '../proactive-agent/entities/memory-event.entity'
import { Notification } from '../proactive-agent/entities/notification.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message, MemoryEntry, MemorySource, MemoryEvent, Notification]), MemoryModule, CharacterStateModule, ProactiveAgentModule, ProviderModule, VectorMemoryModule, CharacterModule],
  controllers: [ConversationController],
  providers: [ConversationService, ConversationRebuildService],
  exports: [ConversationService]
})
export class ConversationModule {}
