import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { randomUUID } from 'crypto'
import { Conversation } from './entities/conversation.entity'
import { Message } from './entities/message.entity'

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name)

  /** 当前活跃的对话 ID（服务重启后重置） */
  private currentConversationId: string | null = null

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>
  ) {}

  /**
   * 保存一轮对话（用户消息 + AI 回复）
   * 保存失败不抛出异常，不影响 SSE 响应
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
}
