import { Injectable, Logger } from '@nestjs/common'
import { LLMService } from '../llm/llm.service'
import { RuntimeModelConfig } from '../llm/llm-types'
import { LLMStreamChunk } from '../llm/llm-adapter.interface'
import { PromptContextService } from './prompt-context.service'
import { ContextWindowManager } from '../context-window/context-window.manager'
import { MemoryExtractorService } from '../memory/memory-extractor.service'
import { MemoryService } from '../memory/memory.service'
import { ProviderService } from '../provider/provider.service'
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
    private readonly memoryService: MemoryService,
    private readonly providerService: ProviderService
  ) {}

  /**
   * 发送消息并获取流式响应
   *
   * 模型配置优先级：
   *   1. modelConfig 参数（前端传入）→ 直接使用
   *   2. DB 中启用的 Provider       → 自动读取
   *   3. .env 环境变量              → 兜底
   *
   * fire-and-forget 提取长期记忆（不阻塞 SSE）
   */
  async sendMessageStream(
    dto: SendMessageDto,
    history: HistoryMessageDto[] = [],
    modelConfig?: Partial<RuntimeModelConfig>,
    characterId?: string
  ): Promise<AsyncIterable<LLMStreamChunk>> {
    this.logger.log(`Received message: ${dto.content.substring(0, 50)}...`)

    // 解析最终模型配置（前端 > DB provider > .env）
    const resolvedConfig = await this.resolveModelConfig(modelConfig)
    this.logger.log(`Using model: ${resolvedConfig.model} @ ${resolvedConfig.apiBaseUrl}`)

    // fire-and-forget：异步提取长期记忆，与聊天使用同一模型配置
    this.extractMemoriesFromMessage(dto.content, resolvedConfig)

    let messages = await this.promptContext.buildMessages(dto.content, history, characterId)

    // 上下文窗口检测与裁剪
    const modelName = resolvedConfig.model
    if (this.contextWindow.checkOverflow(messages, modelName)) {
      messages = this.contextWindow.trimMessages(messages, modelName)
    }

    return this.llmService.chatStream(messages, resolvedConfig)
  }

  /**
   * 解析模型配置：前端配置 > 数据库 Provider > .env
   */
  private async resolveModelConfig(
    modelConfig?: Partial<RuntimeModelConfig>
  ): Promise<Partial<RuntimeModelConfig>> {
    // 1. 前端直接传入 —— 直接使用
    if (modelConfig?.apiKey && modelConfig?.apiBaseUrl) {
      return modelConfig
    }

    // 2. 数据库启用的 Provider —— 自动读取
    try {
      const provider = await this.providerService.getActiveProvider()
      if (provider) {
        return {
          apiKey: provider.api_key,
          apiBaseUrl: provider.base_url,
          model: provider.model,
          temperature: modelConfig?.temperature ?? 0.7,
          maxTokens: modelConfig?.maxTokens ?? 1024
        }
      }
    } catch (error) {
      this.logger.warn('Failed to load provider from DB, falling back to .env:', error)
    }

    // 3. .env 兜底
    return modelConfig || {}
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
