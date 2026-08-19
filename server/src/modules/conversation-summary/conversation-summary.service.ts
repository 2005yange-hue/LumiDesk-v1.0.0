import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { LLMService } from '../llm/llm.service'
import { ResolvedModelConfig, RuntimeModelConfig } from '../llm/llm-types'
import { Conversation } from '../memory/entities/conversation.entity'
import { Message } from '../memory/entities/message.entity'
import { HistoryMessageDto } from '../chat/dto/message-response.dto'
import * as fs from 'fs'
import * as path from 'path'

const SUMMARY_THRESHOLD = 50
const RECENT_MESSAGE_LIMIT = 20
const RAW_CONTEXT_LIMIT = 50

export interface ConversationContext {
  summary: string | null
  history: HistoryMessageDto[]
  historyLimit: number
}

/**
 * 将较早会话记录压缩为摘要，并向聊天流程提供有界的上下文。
 * 原始 messages 永久保留，summary_message_count 仅标记哪些记录已被摘要覆盖。
 */
@Injectable()
export class ConversationSummaryService {
  private readonly logger = new Logger(ConversationSummaryService.name)
  private summaryPromptCache: string | null = null

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    private readonly llmService: LLMService
  ) {}

  /**
   * 当未摘要消息超过 50 条时，将较早内容合并进摘要并保留最近 20 条。
   * 摘要或数据库任一步失败时回退到最近 50 条原始消息，不阻断聊天。
   */
  async getContext(
    conversationId: string | undefined,
    resolvedConfig: ResolvedModelConfig,
    runtimeConfig?: Partial<RuntimeModelConfig>
  ): Promise<ConversationContext | null> {
    if (!conversationId) return null

    try {
      const conversation = await this.conversationRepo.findOne({ where: { id: conversationId } })
      if (!conversation) return null

      const messageCount = await this.messageRepo.count({ where: { conversation_id: conversationId } })
      const summarizedCount = Math.min(conversation.summary_message_count, messageCount)
      const unsummarizedCount = messageCount - summarizedCount

      if (unsummarizedCount > SUMMARY_THRESHOLD) {
        const countToSummarize = unsummarizedCount - RECENT_MESSAGE_LIMIT
        const messagesToSummarize = await this.getMessages(
          conversationId,
          summarizedCount,
          countToSummarize
        )
        const summary = await this.generateSummary(
          conversation.summary,
          messagesToSummarize,
          resolvedConfig,
          runtimeConfig
        )

        if (summary) {
          conversation.summary = summary
          conversation.summary_message_count = summarizedCount + messagesToSummarize.length
          await this.conversationRepo.save(conversation)
          this.logger.log(
            `Updated conversation summary: ${conversationId}, ` +
            `${conversation.summary_message_count}/${messageCount} messages compressed`
          )
        } else {
          this.logger.warn(`Conversation summary skipped: ${conversationId}; using raw history fallback`)
        }
      }

      const refreshedSummaryCount = Math.min(conversation.summary_message_count, messageCount)
      const remainingCount = messageCount - refreshedSummaryCount
      const historyOffset = refreshedSummaryCount + Math.max(remainingCount - RAW_CONTEXT_LIMIT, 0)
      const history = await this.getMessages(
        conversationId,
        historyOffset,
        Math.min(remainingCount, RAW_CONTEXT_LIMIT)
      )

      return {
        summary: conversation.summary,
        history: history.map((message) => ({ role: message.role, content: message.content })),
        historyLimit: RAW_CONTEXT_LIMIT
      }
    } catch (error) {
      this.logger.warn(`Failed to prepare conversation context (non-blocking): ${(error as Error).message}`)
      return null
    }
  }

  private async getMessages(conversationId: string, skip: number, take: number): Promise<Message[]> {
    return this.messageRepo.find({
      where: { conversation_id: conversationId },
      order: { created_at: 'ASC' },
      skip,
      take
    })
  }

  private async generateSummary(
    existingSummary: string | null,
    messages: Message[],
    resolvedConfig: ResolvedModelConfig,
    runtimeConfig?: Partial<RuntimeModelConfig>
  ): Promise<string | null> {
    if (messages.length === 0) return existingSummary

    try {
      const response = await this.llmService.chat(
        [
          { role: 'system', content: this.getSummaryPrompt() },
          {
            role: 'user',
            content: `<existing_summary>\n${existingSummary || '无'}\n</existing_summary>\n\n` +
              `<dialogue_to_merge>\n${this.formatMessages(messages)}\n</dialogue_to_merge>`
          }
        ],
        resolvedConfig,
        runtimeConfig
      )
      const summary = response.content.trim()
      return summary || null
    } catch (error) {
      this.logger.warn(`Failed to generate conversation summary (non-blocking): ${(error as Error).message}`)
      return null
    }
  }

  private formatMessages(messages: Message[]): string {
    return messages
      .map((message) => {
        const role = message.role === 'user' ? '用户' : '角色'
        const content = message.content.length > 1200
          ? `${message.content.slice(0, 1200)}（该条消息已截断）`
          : message.content
        return `${role}：${content}`
      })
      .join('\n\n')
  }

  private getSummaryPrompt(): string {
    if (!this.summaryPromptCache) {
      this.summaryPromptCache = this.loadPrompt('conversation-summary.txt')
    }
    return this.summaryPromptCache
  }

  private loadPrompt(fileName: string): string {
    try {
      const filePath = path.join(__dirname, '..', '..', 'prompts', fileName)
      return fs.readFileSync(filePath, 'utf-8').trim()
    } catch (error) {
      this.logger.warn(`Failed to load prompt: ${fileName}, error: ${(error as Error).message}`)
      return ''
    }
  }
}
