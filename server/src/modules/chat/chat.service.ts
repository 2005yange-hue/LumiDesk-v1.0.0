import { Injectable, Logger } from '@nestjs/common'
import { LLMService } from '../llm/llm.service'
import { RuntimeModelConfig } from '../llm/llm-types'
import { LLMStreamChunk } from '../llm/llm-adapter.interface'
import { PromptContextService } from './prompt-context.service'
import { ContextWindowManager } from '../context-window/context-window.manager'
import { MemoryExtractorService } from '../memory/memory-extractor.service'
import { MemoryService } from '../memory/memory.service'
import { SendMessageDto } from './dto/send-message.dto'
import { HistoryMessageDto } from './dto/message-response.dto'

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)

  constructor(
    private readonly llmService: LLMService,
    private readonly promptContext: PromptContextService,
    private readonly contextWindow: ContextWindowManager,
    private readonly memoryExtractor: MemoryExtractorService,
    private readonly memoryService: MemoryService
  ) {}

  /**
   * 发送消息并获取流式响应
   * 自动检测并裁剪超出上下文窗口的消息
   * fire-and-forget 提取长期记忆（不阻塞 SSE）
   * @param characterId 可选，指定使用的角色ID，不传则使用默认角色
   */
  async sendMessageStream(
    dto: SendMessageDto,
    history: HistoryMessageDto[] = [],
    modelConfig?: Partial<RuntimeModelConfig>,
    characterId?: string
  ): Promise<AsyncIterable<LLMStreamChunk>> {
    this.logger.log(`Received message: ${dto.content.substring(0, 50)}...`)

    // fire-and-forget：异步提取长期记忆，与聊天使用同一模型配置
    this.extractMemoriesFromMessage(dto.content, modelConfig)

    let messages = await this.promptContext.buildMessages(dto.content, history, characterId)

    // 上下文窗口检测与裁剪
    const modelName = modelConfig?.model
    if (this.contextWindow.checkOverflow(messages, modelName)) {
      messages = this.contextWindow.trimMessages(messages, modelName)
    }

    return this.llmService.chatStream(messages, modelConfig)
  }

  /**
   * 从用户消息中异步提取长期记忆（fire-and-forget）
   *
   * 流程：LLM 提取 → MySQL 存储（自动触发向量索引）
   * 完全异步，不阻塞 SSE 流式响应
   * 失败不影响聊天
   */
  private extractMemoriesFromMessage(userMessage: string, modelConfig?: Partial<RuntimeModelConfig>): void {
    this.logger.log(`[Memory] Extraction started for: "${userMessage.substring(0, 80)}"`)

    this.memoryExtractor
      .extractMemories(userMessage, modelConfig)
      .then((entries) => {
        if (entries.length === 0) {
          this.logger.log('[Memory] No extractable memories found')
          return
        }
        this.logger.log(`[Memory] Extracted ${entries.length} memories, saving to MySQL + Chroma...`)
        return this.memoryService.saveMemoryEntries(entries)
      })
      .then((saved) => {
        if (saved && saved.length > 0) {
          this.logger.log(`[Memory] Pipeline complete: ${saved.length} memories saved`)
        }
      })
      .catch((err) => {
        this.logger.warn('[Memory] Extraction pipeline failed (non-blocking):', err)
      })
  }
}
