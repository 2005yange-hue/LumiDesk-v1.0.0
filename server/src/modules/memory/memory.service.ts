import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { randomUUID } from 'crypto'
import { Conversation } from './entities/conversation.entity'
import { Message } from './entities/message.entity'
import { MemoryEntry } from './entities/memory-entry.entity'
import { MemorySource } from './entities/memory-source.entity'
import { VectorMemoryService } from '../vector-memory/vector-memory.service'
import type { MemorySearchResult } from '../vector-memory/vector-memory.service'
import { CharacterService } from '../character/character.service'
import type { MemoryEntryData } from './memory-extractor.service'
import type { UpdateMemoryDto } from './dto/update-memory.dto'
import { MemoryDeduplicationService } from './memory-deduplication.service'
import { MemoryScoringService } from './memory-scoring.service'
import { EventMemoryService } from '../proactive-agent/event-memory.service'

export interface MemoryRetrievalPolicy {
  importanceMultiplier?: number
  relationshipMemoryBonus?: number
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name)

  /** 当前活跃的对话 ID（服务重启后重置） */
  private currentConversationId: string | null = null

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(MemoryEntry)
    private readonly memoryRepo: Repository<MemoryEntry>,
    @InjectRepository(MemorySource)
    private readonly memorySourceRepo: Repository<MemorySource>,
    private readonly vectorMemory: VectorMemoryService,
    private readonly characterService: CharacterService,
    private readonly deduplication: MemoryDeduplicationService,
    private readonly scoring: MemoryScoringService,
    private readonly eventMemoryService: EventMemoryService
  ) {}

  /**
   * 保存一轮对话（用户消息 + AI 回复）
   * 保存失败不抛出异常，不影响 SSE 响应
   *
   * @deprecated 对话保存逻辑已迁移至 ConversationService.saveMessages()。
   *             MemoryService 现在仅负责长期记忆（saveMemoryEntries / getMemoriesByUser）。
   *             请勿在此处新增对话持久化逻辑。
   */
  async saveMessages(
    userMessage: string,
    assistantReply: string,
    characterId?: string
  ): Promise<void> {
    try {
      const conversationId = await this.ensureConversation(characterId)

      await this.messageRepo.insert([
        {
          id: randomUUID(),
          conversation_id: conversationId,
          role: 'user',
          content: userMessage,
          token_count: null,
          created_at: new Date()
        },
        {
          id: randomUUID(),
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantReply,
          token_count: null,
          created_at: new Date()
        }
      ])
      this.logger.debug(`Saved 2 messages to conversation ${conversationId}`)
    } catch (error) {
      this.logger.warn('Failed to save messages (non-blocking):', error)
    }
  }

  /**
   * 确保当前存在活跃对话，不存在则创建
   */
  private async ensureConversation(characterId?: string): Promise<string> {
    if (!this.currentConversationId) {
      const convId = randomUUID()
      await this.conversationRepo.insert({
        id: convId,
        user_id: 'default',
        character_id: characterId || undefined,
        created_at: new Date(),
        updated_at: new Date()
      } as Conversation)
      this.currentConversationId = convId
      this.logger.log(`Created new conversation: ${convId}`)
    }
    return this.currentConversationId
  }

  // ──── 长期记忆 ────

  /**
   * 批量保存长期记忆条目，并自动向量化索引
   * 流程：MySQL 写入 → Embedding → Chroma 存储 → 更新 vector_id
   * 保存失败不抛出异常
   */
  async saveMemoryEntries(
    entries: MemoryEntryData[],
    userId = 'default',
    characterId?: string,
    source?: { conversationId?: string; messageId?: string; assistantMessageId?: string | null }
  ): Promise<MemoryEntry[]> {
    try {
      const resolvedCharacterId = this.resolveCharacterId(characterId)
      const saved: MemoryEntry[] = []

      for (const entry of entries) {
        const decision = await this.deduplication.inspect(entry, userId, resolvedCharacterId)
        if (decision.action === 'merge' && decision.target.origin === 'automatic') {
          const merged = decision.target
          merged.content = this.deduplication.mergeContent(merged.content, entry.content)
          merged.importance = Math.min(1, Math.max(merged.importance, entry.importance) + 0.05)
          merged.confidence = Math.max(merged.confidence, entry.confidence)
          merged.memory_score = this.scoring.calculateScore(merged)
          merged.vector_sync_status = 'pending'
          merged.vector_sync_error = null
          const updated = await this.memoryRepo.save(merged)
          await this.recordSource(updated, source)
          saved.push(updated)
          await this.eventMemoryService.scheduleFromMemory(updated)
          void this.syncMemoryVector(updated, true)
          continue
        }

        const record = this.memoryRepo.create({
          user_id: userId,
          character_id: resolvedCharacterId,
          origin: 'automatic',
          source_conversation_id: source?.conversationId ?? null,
          source_message_id: source?.messageId ?? null,
          source_assistant_message_id: source?.assistantMessageId ?? null,
          type: entry.type,
          content: entry.content,
          importance: entry.importance,
          confidence: entry.confidence,
          status: 'active',
          replacement_memory_id: null,
          usage_count: 0,
          memory_score: 0,
          last_used_at: null,
          last_decay_at: null,
          vector_sync_status: 'pending',
          vector_sync_error: null
        })
        record.memory_score = this.scoring.calculateScore(record)
        const created = await this.memoryRepo.save(record)
        await this.recordSource(created, source)

        if (decision.action === 'supersede') {
          decision.target.status = 'superseded'
          decision.target.replacement_memory_id = created.id
          await this.memoryRepo.save(decision.target)
          await this.eventMemoryService.cancelByMemoryId(decision.target.id)
          void this.syncMemoryVector(decision.target, false)
        }

        saved.push(created)
        await this.eventMemoryService.scheduleFromMemory(created)
        void this.syncMemoryVector(created, true)
      }

      this.logger.log(`Saved ${saved.length} memory entries: ${saved.map((e) => `[${e.type}] ${e.content}`).join(', ')}`)

      return saved
    } catch (error) {
      this.logger.warn('Failed to save memory entries (non-blocking):', error)
      return []
    }
  }

  private async recordSource(
    memory: MemoryEntry,
    source?: { conversationId?: string; messageId?: string; assistantMessageId?: string | null }
  ): Promise<void> {
    if (!source?.conversationId || !source.messageId) return

    const existing = await this.memorySourceRepo.findOne({
      where: {
        memory_id: memory.id,
        conversation_id: source.conversationId,
        user_message_id: source.messageId
      }
    })
    if (existing) return

    await this.memorySourceRepo.save(this.memorySourceRepo.create({
      memory_id: memory.id,
      conversation_id: source.conversationId,
      user_message_id: source.messageId,
      assistant_message_id: source.assistantMessageId ?? null
    }))
  }

  /**
   * 查询用户的高重要性记忆（Top N）
   * @param userId 用户 ID
   * @param limit  返回数量上限
   */
  async getMemoriesByUser(
    userId = 'default',
    limit = 10,
    characterId?: string,
    policy: MemoryRetrievalPolicy = {}
  ): Promise<MemoryEntry[]> {
    try {
      const resolvedCharacterId = this.resolveCharacterId(characterId)
      const query = this.memoryRepo
        .createQueryBuilder('memory')
        .where('memory.user_id = :userId', { userId })
        .andWhere('memory.status = :status', { status: 'active' })

      if (resolvedCharacterId) {
        query
          .andWhere('(memory.character_id = :characterId OR memory.character_id IS NULL)', {
            characterId: resolvedCharacterId
          })
          .addSelect('CASE WHEN memory.character_id = :characterId THEN 1 ELSE 0 END', 'character_match')
          .orderBy('character_match', 'DESC')
      }

      query
        .addSelect(
          'memory.memory_score * :importanceMultiplier + CASE WHEN memory.type = :relationshipType THEN :relationshipMemoryBonus ELSE 0 END',
          'memory_priority'
        )
        .setParameters({
          importanceMultiplier: policy.importanceMultiplier ?? 1,
          relationshipMemoryBonus: policy.relationshipMemoryBonus ?? 0,
          relationshipType: 'relationship'
        })

      return query
        .addOrderBy('memory_priority', 'DESC')
        .addOrderBy('memory.memory_score', 'DESC')
        .addOrderBy('memory.importance', 'DESC')
        .addOrderBy('memory.confidence', 'DESC')
        .addOrderBy('memory.updated_at', 'DESC')
        .take(limit)
        .getMany()
    } catch (error) {
      this.logger.warn('Failed to load memories:', error)
      return []
    }
  }

  /** 标记已进入 Prompt 上下文的记忆，失败不影响聊天。 */
  async markMemoriesUsed(memoryIds: number[]): Promise<void> {
    const ids = [...new Set(memoryIds.filter((id) => Number.isInteger(id) && id > 0))]
    if (ids.length === 0) return

    try {
      const memories = await this.memoryRepo.findByIds(ids)
      const now = new Date()
      for (const memory of memories) {
        if (memory.status !== 'active') continue
        memory.last_used_at = now
        memory.usage_count += 1
        memory.memory_score = this.scoring.calculateScore(memory)
      }
      await this.memoryRepo.save(memories)
    } catch (error) {
      this.logger.warn('Failed to update memory last_used_at:', error)
    }
  }

  /** 查询指定角色可见的全部记忆（包含历史全局记忆）。 */
  async getManagedMemories(userCharacterId: string, userId = 'default'): Promise<MemoryEntry[]> {
    if (!this.characterService.findOne(userCharacterId)) {
      throw new NotFoundException('角色不存在')
    }

    return this.memoryRepo
      .createQueryBuilder('memory')
      .where('memory.user_id = :userId', { userId })
      .andWhere('(memory.character_id = :characterId OR memory.character_id IS NULL)', {
        characterId: userCharacterId
      })
      .orderBy(
        `CASE memory.status
          WHEN 'active' THEN 0
          WHEN 'superseded' THEN 1
          WHEN 'archived' THEN 2
          ELSE 3
        END`,
        'ASC'
      )
      .addOrderBy(
        `CASE memory.type
          WHEN 'relationship' THEN 0
          WHEN 'preference' THEN 1
          WHEN 'personality' THEN 2
          WHEN 'event' THEN 3
          WHEN 'fact' THEN 4
          ELSE 5
        END`,
        'ASC'
      )
      .addOrderBy('memory.importance', 'DESC')
      .addOrderBy('memory.memory_score', 'DESC')
      .addOrderBy('memory.updated_at', 'DESC')
      .getMany()
  }

  /** 修改记忆内容与可编辑元数据，并同步 Chroma 向量。 */
  async updateMemory(id: string, dto: UpdateMemoryDto, userId = 'default'): Promise<MemoryEntry> {
    const memoryId = this.parseMemoryId(id)
    const existing = await this.memoryRepo.findOne({ where: { id: memoryId, user_id: userId } })
    if (!existing) throw new NotFoundException('记忆不存在')

    const content = dto.content ?? existing.content
    const type = dto.type ?? existing.type
    const importance = dto.importance ?? existing.importance
    const contentChanged = content !== existing.content

    await this.memoryRepo.update(existing.id, {
      type,
      content,
      importance,
      memory_score: this.scoring.calculateScore({ ...existing, type, importance }),
      vector_sync_status: 'pending',
      vector_sync_error: null
    })

    const updatedMemory = await this.memoryRepo.findOneOrFail({ where: { id: existing.id } })
    if (updatedMemory.type === 'event') {
      await this.eventMemoryService.scheduleFromMemory(updatedMemory)
    } else if (existing.type === 'event') {
      await this.eventMemoryService.cancelByMemoryId(existing.id)
    }

    try {
      const vectorId = existing.vector_id || String(existing.id)
      await this.vectorMemory.updateMemory(
        vectorId,
        existing.user_id,
        content,
        {
          type,
          importance,
          confidence: existing.confidence,
          memoryScore: this.scoring.calculateScore({ ...existing, type, importance }),
          status: existing.status,
          ...(existing.character_id ? { characterId: existing.character_id } : {})
        },
        contentChanged,
        Boolean(existing.vector_id)
      )

      await this.memoryRepo.update(existing.id, {
        vector_id: vectorId,
        vector_sync_status: 'synced',
        vector_sync_error: null
      })
    } catch (error) {
      const errorMessage = this.getErrorMessage(error)
      await this.memoryRepo.update(existing.id, {
        vector_sync_status: 'failed',
        vector_sync_error: errorMessage
      })
      this.logger.warn(`Memory ${existing.id} saved but vector sync failed: ${errorMessage}`)
    }

    return this.memoryRepo.findOneOrFail({ where: { id: existing.id } })
  }

  /** 用 MySQL 最新状态过滤并补全 Chroma 检索结果，避免已替代/归档记忆进入 Prompt。 */
  async hydrateActiveVectorResults(results: MemorySearchResult[]): Promise<MemorySearchResult[]> {
    const ids = [...new Set(results.map((result) => Number.parseInt(result.memoryId, 10)).filter(Number.isInteger))]
    if (ids.length === 0) return []

    const memories = await this.memoryRepo
      .createQueryBuilder('memory')
      .whereInIds(ids)
      .andWhere('memory.status = :status', { status: 'active' })
      .getMany()
    const memoryById = new Map(memories.map((memory) => [String(memory.id), memory]))

    return results.flatMap((result) => {
      const memory = memoryById.get(result.memoryId)
      if (!memory) return []
      return [{
        ...result,
        content: memory.content,
        type: memory.type,
        importance: memory.importance,
        confidence: memory.confidence,
        memoryScore: memory.memory_score,
        status: memory.status
      }]
    })
  }

  /** 先删除 Chroma 向量，再删除 MySQL 记忆记录。 */
  async deleteMemory(id: string, userId = 'default'): Promise<{ success: boolean }> {
    const memoryId = this.parseMemoryId(id)
    const existing = await this.memoryRepo.findOne({ where: { id: memoryId, user_id: userId } })
    if (!existing) throw new NotFoundException('记忆不存在')

    if (existing.vector_id) {
      try {
        await this.vectorMemory.deleteMemory(existing.vector_id)
      } catch (error) {
        const errorMessage = this.getErrorMessage(error)
        await this.memoryRepo.update(existing.id, {
          vector_sync_status: 'failed',
          vector_sync_error: errorMessage
        })
        throw new ServiceUnavailableException(`记忆未删除，向量删除失败：${errorMessage}`)
      }
    }

    await this.eventMemoryService.cancelByMemoryId(existing.id)
    await this.memoryRepo.delete(existing.id)
    return { success: true }
  }

  private parseMemoryId(id: string): number {
    const memoryId = Number(id)
    if (!Number.isInteger(memoryId) || memoryId <= 0) {
      throw new NotFoundException('记忆不存在')
    }
    return memoryId
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  private async syncMemoryVector(memory: MemoryEntry, contentChanged: boolean): Promise<void> {
    try {
      const vectorId = memory.vector_id || String(memory.id)
      await this.vectorMemory.updateMemory(
        vectorId,
        memory.user_id,
        memory.content,
        {
          type: memory.type,
          importance: memory.importance,
          confidence: memory.confidence,
          memoryScore: memory.memory_score,
          status: memory.status,
          ...(memory.character_id ? { characterId: memory.character_id } : {})
        },
        contentChanged,
        Boolean(memory.vector_id)
      )
      await this.memoryRepo.update(memory.id, {
        vector_id: vectorId,
        vector_sync_status: 'synced',
        vector_sync_error: null
      })
    } catch (error) {
      await this.memoryRepo.update(memory.id, {
        vector_sync_status: 'failed',
        vector_sync_error: this.getErrorMessage(error)
      })
    }
  }

  private resolveCharacterId(characterId?: string): string | null {
    if (characterId) return this.characterService.findOne(characterId)?.id ?? null
    return this.characterService.getDefault()?.id ?? null
  }
}
