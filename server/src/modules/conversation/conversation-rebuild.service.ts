import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { CharacterService } from '../character/character.service'
import { RelationshipInteractionService } from '../character-state/relationship-interaction.service'
import { ResolvedModelConfig } from '../llm/llm-types'
import { MemoryExtractorService } from '../memory/memory-extractor.service'
import { MemoryService } from '../memory/memory.service'
import { Conversation } from '../memory/entities/conversation.entity'
import { MemoryEntry } from '../memory/entities/memory-entry.entity'
import { MemorySource } from '../memory/entities/memory-source.entity'
import { Message } from '../memory/entities/message.entity'
import { ProviderService } from '../provider/provider.service'
import { MemoryEvent } from '../proactive-agent/entities/memory-event.entity'
import { Notification } from '../proactive-agent/entities/notification.entity'
import { VectorMemoryService } from '../vector-memory/vector-memory.service'

@Injectable()
export class ConversationRebuildService {
  private readonly logger = new Logger(ConversationRebuildService.name)
  private readonly queued = new Set<string>()

  constructor(
    @InjectRepository(Conversation) private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>,
    @InjectRepository(MemoryEntry) private readonly memoryRepo: Repository<MemoryEntry>,
    @InjectRepository(MemorySource) private readonly sourceRepo: Repository<MemorySource>,
    @InjectRepository(MemoryEvent) private readonly eventRepo: Repository<MemoryEvent>,
    @InjectRepository(Notification) private readonly notificationRepo: Repository<Notification>,
    private readonly memoryExtractor: MemoryExtractorService,
    private readonly memoryService: MemoryService,
    private readonly vectorMemory: VectorMemoryService,
    private readonly providerService: ProviderService,
    private readonly characterService: CharacterService,
    private readonly relationshipInteractions: RelationshipInteractionService,
    private readonly configService: ConfigService
  ) {}

  scheduleRebuild(conversationId: string): void {
    if (this.queued.has(conversationId)) return
    this.queued.add(conversationId)
    void this.rebuild(conversationId).catch((error) => {
      this.logger.error('Conversation rebuild failed for ' + conversationId, error instanceof Error ? error.stack : error)
    }).finally(() => this.queued.delete(conversationId))
  }

  async removeConversationArtifacts(conversationId: string): Promise<void> {
    await this.backfillSources(conversationId)
    await this.removeSourcesForConversation(conversationId)
  }

  private async rebuild(conversationId: string): Promise<void> {
    const conversation = await this.conversationRepo.findOne({ where: { id: conversationId } })
    if (!conversation) return

    await this.backfillSources(conversationId)
    await this.removeSourcesForConversation(conversationId)

    const characterId = this.resolveCharacterId(conversation.character_id)
    const messages = await this.messageRepo.find({
      where: { conversation_id: conversationId },
      order: { created_at: 'ASC', id: 'ASC' }
    })
    const config = await this.resolveModelConfig()
    if (config && characterId) {
      for (let index = 0; index < messages.length; index += 1) {
        const userMessage = messages[index]
        if (userMessage.role !== 'user') continue
        const assistantMessage = messages.slice(index + 1).find((message) =>
          message.role === 'assistant' && (!userMessage.turn_id || message.turn_id === userMessage.turn_id)
        )
        try {
          const entries = await this.memoryExtractor.extractMemories(userMessage.content, config)
          if (entries.length > 0) {
            await this.memoryService.saveMemoryEntries(entries, 'default', characterId, {
              conversationId,
              messageId: userMessage.id,
              assistantMessageId: assistantMessage?.id ?? null
            })
          }
        } catch (error) {
          this.logger.warn('Failed to rebuild memories for message ' + userMessage.id + ': ' + (error instanceof Error ? error.message : String(error)))
        }
      }
    }

    if (characterId) await this.relationshipInteractions.rebuildCharacter(characterId)
    this.logger.log('Rebuilt automatic artifacts for conversation ' + conversationId)
  }

  private async backfillSources(conversationId: string): Promise<void> {
    const records = await this.memoryRepo.find({
      where: { origin: 'automatic', source_conversation_id: conversationId }
    })
    for (const memory of records) {
      if (!memory.source_message_id) continue
      const existing = await this.sourceRepo.findOne({
        where: { memory_id: memory.id, conversation_id: conversationId, user_message_id: memory.source_message_id }
      })
      if (!existing) {
        await this.sourceRepo.save(this.sourceRepo.create({
          memory_id: memory.id,
          conversation_id: conversationId,
          user_message_id: memory.source_message_id,
          assistant_message_id: memory.source_assistant_message_id
        }))
      }
    }
  }

  private async removeSourcesForConversation(conversationId: string): Promise<void> {
    const sources = await this.sourceRepo.find({ where: { conversation_id: conversationId } })
    const memoryIds = [...new Set(sources.map((source) => source.memory_id))]
    if (sources.length > 0) await this.sourceRepo.delete({ conversation_id: conversationId })

    for (const memoryId of memoryIds) {
      const remaining = await this.sourceRepo.count({ where: { memory_id: memoryId } })
      if (remaining > 0) continue
      const memory = await this.memoryRepo.findOne({ where: { id: memoryId, origin: 'automatic' } })
      if (memory) await this.deleteOrRetainUnsyncedMemory(memory)
    }
  }

  private async deleteOrRetainUnsyncedMemory(memory: MemoryEntry): Promise<void> {
    if (memory.vector_id) {
      try {
        await this.vectorMemory.deleteMemory(memory.vector_id)
      } catch (error) {
        memory.vector_sync_status = 'failed'
        memory.vector_sync_error = error instanceof Error ? error.message : String(error)
        memory.deletion_pending = true
        memory.status = 'archived'
        await this.memoryRepo.save(memory)
        return
      }
    }

    const events = await this.eventRepo.find({ where: { memory_id: memory.id } })
    const eventIds = events.map((event) => event.id)
    const notificationWhere = eventIds.length > 0
      ? [{ source_memory_id: memory.id }, { memory_event_id: In(eventIds) }]
      : [{ source_memory_id: memory.id }]
    await this.notificationRepo.delete(notificationWhere)
    if (eventIds.length > 0) await this.eventRepo.delete({ id: In(eventIds) })
    await this.memoryRepo.delete(memory.id)
  }

  private async resolveModelConfig(): Promise<ResolvedModelConfig | null> {
    const provider = await this.providerService.getDefaultProvider()
    const apiKey = provider?.api_key || this.configService.get<string>('LLM_API_KEY', '')
    if (!apiKey) {
      this.logger.warn('Skipped automatic memory rebuild because no model provider is configured')
      return null
    }
    return {
      apiKey,
      apiBaseUrl: provider?.base_url || this.configService.get<string>('LLM_BASE_URL', 'https://api.openai.com/v1'),
      model: provider?.model || this.configService.get<string>('LLM_MODEL', 'gpt-4o'),
      temperature: provider?.temperature ?? 0.7,
      maxTokens: provider?.max_tokens ?? 1024
    }
  }

  private resolveCharacterId(characterId: string | null): string | null {
    if (characterId && this.characterService.findOne(characterId)) return characterId
    return this.characterService.getDefault()?.id ?? null
  }
}
