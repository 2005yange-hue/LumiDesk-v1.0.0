import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { randomUUID } from 'crypto'
import { Conversation } from '../memory/entities/conversation.entity'
import { Message } from '../memory/entities/message.entity'
import { EmotionRecord } from '../emotion/entities/emotion-record.entity'
import { CreateConversationDto } from './dto/create-conversation.dto'
import { UpdateConversationDto } from './dto/update-conversation.dto'
import { ConversationRebuildService } from './conversation-rebuild.service'

export interface ConversationMutationResult {
  content: string
  deletedCount: number
  remainingCount: number
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name)
  private currentConversationId: string | null = null

  constructor(
    @InjectRepository(Conversation) private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>,
    private readonly rebuildService: ConversationRebuildService
  ) {}

  async listConversations(userId = 'default'): Promise<Conversation[]> {
    return this.conversationRepo.find({ where: { user_id: userId }, order: { updated_at: 'DESC' }, select: ['id', 'title', 'message_count', 'created_at', 'updated_at'] })
  }

  async getConversation(id: string): Promise<Conversation> {
    const conversation = await this.conversationRepo.findOne({ where: { id } })
    if (!conversation) throw new NotFoundException('会话 ' + id + ' 不存在')
    return conversation
  }

  async createConversation(dto: CreateConversationDto, userId = 'default'): Promise<Conversation> {
    const now = new Date()
    return this.conversationRepo.save(this.conversationRepo.create({ id: randomUUID(), user_id: userId, message_count: 0, created_at: now, updated_at: now, ...(dto.title !== undefined ? { title: dto.title } : {}) }))
  }

  async updateConversation(id: string, dto: UpdateConversationDto): Promise<Conversation> {
    await this.getConversation(id)
    await this.conversationRepo.update(id, { title: dto.title })
    return this.getConversation(id)
  }

  async deleteConversation(id: string): Promise<void> {
    await this.getConversation(id)
    await this.rebuildService.removeConversationArtifacts(id)
    await this.conversationRepo.manager.transaction(async (manager) => {
      await manager.delete(EmotionRecord, { conversation_id: id })
      await manager.delete(Message, { conversation_id: id })
      await manager.delete(Conversation, { id })
    })
  }

  private async ensureConversation(): Promise<string> {
    if (!this.currentConversationId) this.currentConversationId = (await this.createConversation({})).id
    return this.currentConversationId
  }

  async getMessages(conversationId: string, page = 1, limit = 50): Promise<{ messages: Message[]; total: number }> {
    await this.getConversation(conversationId)
    const [messages, total] = await this.messageRepo.findAndCount({ where: { conversation_id: conversationId }, order: { created_at: 'DESC', id: 'DESC' }, skip: (page - 1) * limit, take: limit })
    return { messages: messages.reverse(), total }
  }

  async getAllMessages(conversationId: string): Promise<Message[]> {
    return this.messageRepo.find({ where: { conversation_id: conversationId }, order: { created_at: 'ASC', id: 'ASC' } })
  }

  async saveMessages(conversationId: string, userMessage: string, assistantReply: string, characterId?: string): Promise<{ userMessageId: string; assistantMessageId: string } | null> {
    try {
      const now = new Date()
      const turnId = randomUUID()
      const userMessageId = randomUUID()
      const assistantMessageId = randomUUID()
      await this.messageRepo.insert([
        { id: userMessageId, conversation_id: conversationId, role: 'user', content: userMessage, turn_id: turnId, token_count: null, created_at: now },
        { id: assistantMessageId, conversation_id: conversationId, role: 'assistant', content: assistantReply, turn_id: turnId, token_count: null, created_at: new Date(now.getTime() + 1) }
      ])
      await this.conversationRepo.increment({ id: conversationId }, 'message_count', 2)
      const conversation = await this.conversationRepo.findOne({ where: { id: conversationId } })
      if (characterId && conversation && !conversation.character_id) {
        await this.conversationRepo.update(conversationId, { character_id: characterId })
      }
      await this.generateTitleIfNeeded(conversationId, userMessage)
      return { userMessageId, assistantMessageId }
    } catch (error) {
      this.logger.warn('Failed to save messages (non-blocking):', error)
      return null
    }
  }

  async saveCurrentMessages(userMessage: string, assistantReply: string, conversationId?: string, characterId?: string): Promise<{ userMessageId: string; assistantMessageId: string } | null> {
    return this.saveMessages(conversationId ?? await this.ensureConversation(), userMessage, assistantReply, characterId)
  }

  async prepareEdit(conversationId: string, messageId: string, content: string): Promise<ConversationMutationResult> {
    const messages = await this.requireMessages(conversationId)
    const index = messages.findIndex((message) => message.id === messageId)
    if (index < 0) throw new NotFoundException('消息不存在')
    if (messages[index].role !== 'user') throw new BadRequestException('只能编辑用户消息')
    return this.deleteFromIndex(conversationId, messages, index, content.trim())
  }

  async prepareRegenerate(conversationId: string, messageId: string): Promise<ConversationMutationResult> {
    const messages = await this.requireMessages(conversationId)
    const index = messages.findIndex((message) => message.id === messageId)
    if (index < 0) throw new NotFoundException('消息不存在')
    if (messages[index].role !== 'assistant') throw new BadRequestException('只能重新生成角色回复')
    const start = this.findTurnStart(messages, index)
    if (start < 0) throw new BadRequestException('找不到对应的用户消息')
    return this.deleteFromIndex(conversationId, messages, start, messages[start].content)
  }

  async deleteFromMessage(conversationId: string, messageId: string): Promise<ConversationMutationResult> {
    const messages = await this.requireMessages(conversationId)
    const index = messages.findIndex((message) => message.id === messageId)
    if (index < 0) throw new NotFoundException('消息不存在')
    const start = messages[index].role === 'assistant' ? this.findTurnStart(messages, index) : index
    return this.deleteFromIndex(conversationId, messages, Math.max(0, start), '')
  }

  async exportConversation(conversationId: string, format: 'markdown' | 'json'): Promise<{ filename: string; content: string; mimeType: string }> {
    const conversation = await this.getConversation(conversationId)
    const messages = await this.getAllMessages(conversationId)
    const title = (conversation.title || 'conversation').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)
    if (format === 'json') return { filename: title + '.json', mimeType: 'application/json;charset=utf-8', content: JSON.stringify({ conversation, messages }, null, 2) }
    const content = ['# ' + (conversation.title || '未命名会话'), '', ...messages.map((message) => '## ' + (message.role === 'user' ? '用户' : '角色') + '\n\n' + message.content + '\n')].join('\n')
    return { filename: title + '.md', mimeType: 'text/markdown;charset=utf-8', content }
  }

  private async requireMessages(conversationId: string): Promise<Message[]> {
    await this.getConversation(conversationId)
    const messages = await this.getAllMessages(conversationId)
    if (!messages.length) throw new BadRequestException('会话没有可操作的消息')
    return messages
  }

  private findTurnStart(messages: Message[], index: number): number {
    const target = messages[index]
    if (target.turn_id) {
      const matched = messages.findIndex((message) => message.turn_id === target.turn_id && message.role === 'user')
      if (matched >= 0) return matched
    }
    for (let cursor = index - 1; cursor >= 0; cursor--) if (messages[cursor].role === 'user') return cursor
    return -1
  }

  private async deleteFromIndex(conversationId: string, messages: Message[], start: number, content: string): Promise<ConversationMutationResult> {
    const deleted = messages.slice(start)
    const deletedUserMessageIds = deleted.filter((message) => message.role === 'user').map((message) => message.id)
    await this.conversationRepo.manager.transaction(async (manager) => {
      if (deletedUserMessageIds.length) {
        await manager.delete(EmotionRecord, { conversation_id: conversationId, user_message_id: In(deletedUserMessageIds) })
      }
      await manager.delete(Message, { id: In(deleted.map((message) => message.id)) })
      await manager.update(Conversation, { id: conversationId }, { message_count: start, summary: null, summary_message_count: 0 })
    })
    this.rebuildService.scheduleRebuild(conversationId)
    return { content, deletedCount: deleted.length, remainingCount: start }
  }

  private async generateTitleIfNeeded(conversationId: string, userMessage: string): Promise<void> {
    const conversation = await this.conversationRepo.findOne({ where: { id: conversationId } })
    if (!conversation || conversation.title) return
    const cleaned = userMessage.replace(/\r?\n/g, ' ').trim()
    if (cleaned) await this.conversationRepo.update(conversationId, { title: cleaned.length > 20 ? cleaned.slice(0, 20) + '...' : cleaned })
  }
}
