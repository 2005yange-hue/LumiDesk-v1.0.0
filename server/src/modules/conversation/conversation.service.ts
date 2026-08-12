import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { randomUUID } from 'crypto'
import { Conversation } from '../memory/entities/conversation.entity'
import { Message } from '../memory/entities/message.entity'
import type { CreateConversationDto } from './dto/create-conversation.dto'
import type { UpdateConversationDto } from './dto/update-conversation.dto'

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name)

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>
  ) {}

  // ====================================================
  // Conversation CRUD
  // ====================================================

  /** 获取用户的所有会话列表（按更新时间倒序） */
  async listConversations(userId = 'default'): Promise<Conversation[]> {
    return this.conversationRepo.find({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
      select: ['id', 'title', 'message_count', 'created_at', 'updated_at']
    })
  }

  /** 获取单个会话 */
  async getConversation(id: string): Promise<Conversation> {
    const conversation = await this.conversationRepo.findOne({
      where: { id },
      select: ['id', 'user_id', 'character_id', 'title', 'message_count', 'created_at', 'updated_at']
    })
    if (!conversation) throw new NotFoundException(`会话 ${id} 不存在`)
    return conversation
  }

  /** 创建新会话 */
  async createConversation(dto: CreateConversationDto, userId = 'default'): Promise<Conversation> {
    const id = randomUUID()
    const now = new Date()
    const record = this.conversationRepo.create({
      id,
      user_id: userId,
      message_count: 0,
      created_at: now,
      updated_at: now,
      ...(dto.title !== undefined ? { title: dto.title } : {})
    })
    const saved = await this.conversationRepo.save(record)
    this.logger.log(`Created conversation: ${saved.id}`)
    return saved
  }

  /** 更新会话标题 */
  async updateConversation(id: string, dto: UpdateConversationDto): Promise<Conversation> {
    await this.getConversation(id) // 确保存在
    await this.conversationRepo.update(id, { title: dto.title })
    this.logger.log(`Updated conversation title: ${id}`)
    return this.getConversation(id)
  }

  /**
   * 删除会话及其所有关联消息
   * 使用数据库事务保证原子性
   */
  async deleteConversation(id: string): Promise<void> {
    await this.getConversation(id) // 确保存在

    await this.conversationRepo.manager.transaction(async (manager) => {
      await manager.delete(Message, { conversation_id: id })
      await manager.delete(Conversation, { id })
    })

    this.logger.log(`Deleted conversation and messages: ${id}`)
  }

  // ====================================================
  // Message
  // ====================================================

  /** 当前活跃的会话 ID（服务重启后重置） */
  private currentConversationId: string | null = null

  /**
   * 获取或创建当前活跃会话
   */
  private async ensureConversation(): Promise<string> {
    if (!this.currentConversationId) {
      const conv = await this.createConversation({})
      this.currentConversationId = conv.id
    }
    return this.currentConversationId
  }

  /** 分页获取会话的历史消息 */
  async getMessages(
    conversationId: string,
    page = 1,
    limit = 50
  ): Promise<{ messages: Message[]; total: number }> {
    await this.getConversation(conversationId) // 确保存在

    const [messages, total] = await this.messageRepo.findAndCount({
      where: { conversation_id: conversationId },
      order: { created_at: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
      select: ['id', 'role', 'content', 'token_count', 'created_at']
    })

    return { messages, total }
  }

  /**
   * 保存一轮对话（用户消息 + AI 回复）
   * 自动更新 conversation.message_count（increment +2）
   * 保存失败不抛出异常，不影响 SSE 响应
   */
  async saveMessages(
    conversationId: string,
    userMessage: string,
    assistantReply: string
  ): Promise<void> {
    try {
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

      // 缓存字段：使用 increment 避免 COUNT 查询
      await this.conversationRepo.increment({ id: conversationId }, 'message_count', 2)

      // 首次聊天时自动生成标题（标题为默认空值时）
      await this.generateTitleIfNeeded(conversationId, userMessage)

      this.logger.debug(`Saved 2 messages to conversation ${conversationId}`)
    } catch (error) {
      this.logger.warn('Failed to save messages (non-blocking):', error)
    }
  }

  /**
   * 若会话标题为空（默认值），则根据首条用户消息生成标题
   * 不调用 LLM，纯文本截断处理
   */
  private async generateTitleIfNeeded(conversationId: string, firstMessage: string): Promise<void> {
    try {
      const conversation = await this.conversationRepo.findOne({
        where: { id: conversationId }
      })
      if (!conversation || conversation.title) return

      const title = this.buildTitle(firstMessage)
      if (!title) return

      await this.conversationRepo.update(conversationId, { title })
      this.logger.log(`Generated title for conversation ${conversationId}: ${title}`)
    } catch (error) {
      this.logger.warn('Failed to generate conversation title (non-blocking):', error)
    }
  }

  /**
   * 从用户消息生成标题：
   * - 去除换行
   * - 去除首尾空格
   * - 最大长度 20 字符，超出追加 "..."
   * - 空消息返回空字符串（不处理）
   */
  private buildTitle(message: string): string {
    const cleaned = message.replace(/\r?\n/g, ' ').trim()
    if (!cleaned) return ''

    const MAX_TITLE_LENGTH = 20
    return cleaned.length > MAX_TITLE_LENGTH
      ? cleaned.slice(0, MAX_TITLE_LENGTH) + '...'
      : cleaned
  }

  /**
   * 保存当前活跃会话的一轮对话
   * 自动确保活跃会话存在（服务重启后首次调用会创建新会话）
   */
  async saveCurrentMessages(userMessage: string, assistantReply: string): Promise<void> {
    const conversationId = await this.ensureConversation()
    await this.saveMessages(conversationId, userMessage, assistantReply)
  }
}
