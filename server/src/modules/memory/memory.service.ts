import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { randomUUID } from 'crypto'
import { Conversation } from './entities/conversation.entity'
import { Message } from './entities/message.entity'
import { MemoryEntry } from './entities/memory-entry.entity'
import { VectorMemoryService } from '../vector-memory/vector-memory.service'

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
    private readonly vectorMemory: VectorMemoryService
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
    entries: Array<{ type: string; content: string; importance: number }>,
    userId = 'default'
  ): Promise<MemoryEntry[]> {
    try {
      const records = entries.map((e) =>
        this.memoryRepo.create({
          user_id: userId,
          type: e.type,
          content: e.content,
          importance: e.importance
        })
      )
      const saved = await this.memoryRepo.save(records)
      this.logger.log(`Saved ${saved.length} memory entries: ${saved.map((e) => `[${e.type}] ${e.content}`).join(', ')}`)

      // 异步向量化索引（fire-and-forget，不阻塞返回）
      for (const entry of saved) {
        this.vectorMemory.indexMemory(
          String(entry.id),
          entry.user_id,
          entry.content,
          { type: entry.type, importance: entry.importance }
        ).then((vectorId) => {
          if (vectorId) {
            // 更新 MySQL 中的 vector_id，建立关联
            this.memoryRepo.update(entry.id, { vector_id: `memory_${entry.id}` })
              .catch((err) => this.logger.warn('Failed to update vector_id:', err))
          }
        })
      }

      return saved
    } catch (error) {
      this.logger.warn('Failed to save memory entries (non-blocking):', error)
      return []
    }
  }

  /**
   * 查询用户的高重要性记忆（Top N）
   * @param userId 用户 ID
   * @param limit  返回数量上限
   */
  async getMemoriesByUser(userId = 'default', limit = 10): Promise<MemoryEntry[]> {
    try {
      return this.memoryRepo.find({
        where: { user_id: userId },
        order: { importance: 'DESC', created_at: 'DESC' },
        take: limit
      })
    } catch (error) {
      this.logger.warn('Failed to load memories:', error)
      return []
    }
  }
}
