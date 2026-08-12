import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { LLMService } from '../llm/llm.service'
import { RuntimeModelConfig, ResolvedModelConfig } from '../llm/llm-types'
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
    private readonly providerService: ProviderService,
    private readonly configService: ConfigService
  ) {}

  /**
   * 发送消息并获取流式响应
   *
   * 模型配置优先级：
   *   1. modelConfig.providerId → 查询 DB 获取完整 api_key
   *   2. DB 中启用的 Provider     → 自动读取
   *   3. .env 环境变量            → 兜底
   *
   * 前端不再传递 api_key / api_base_url，避免脱敏 Key 覆盖。
   * fire-and-forget 提取长期记忆（不阻塞 SSE）
   */
  async sendMessageStream(
    dto: SendMessageDto,
    history: HistoryMessageDto[] = [],
    modelConfig?: Partial<RuntimeModelConfig>,
    characterId?: string
  ): Promise<AsyncIterable<LLMStreamChunk>> {
    this.logger.log(`Received message: ${dto.content.substring(0, 50)}...`)

    this.logger.log(
      `[Provider Debug] sendMessageStream → frontend modelConfig: ` +
      `providerId=${modelConfig?.providerId ?? '<none>'}, ` +
      `model=${modelConfig?.model || '<empty>'}`
    )

    // 解析完整配置（含凭据）
    const resolvedConfig = await this.resolveModelConfig(modelConfig)
    this.logger.log(
      `[Provider Debug] resolvedConfig → model=${resolvedConfig.model}, ` +
      `baseURL=${resolvedConfig.apiBaseUrl}, ` +
      `api_key=${this.#safeKeyPrefix(resolvedConfig.apiKey)}, ` +
      `temperature=${resolvedConfig.temperature}`
    )

    // fire-and-forget：异步提取长期记忆
    this.extractMemoriesFromMessage(dto.content, resolvedConfig, modelConfig)

    let messages = await this.promptContext.buildMessages(dto.content, history, characterId)

    // 上下文窗口检测与裁剪
    const modelName = resolvedConfig.model
    if (this.contextWindow.checkOverflow(messages, modelName)) {
      messages = this.contextWindow.trimMessages(messages, modelName)
    }

    return this.llmService.chatStream(messages, resolvedConfig, modelConfig)
  }

  /**
   * 解析模型配置：providerId(前端) > default Provider > .env
   * 返回 ResolvedModelConfig（含完整 api_key）
   */
  private async resolveModelConfig(
    modelConfig?: Partial<RuntimeModelConfig>
  ): Promise<ResolvedModelConfig> {
    // 1. 按 providerId 精确查找
    if (modelConfig?.providerId) {
      try {
        const provider = await this.providerService.findProviderById(modelConfig.providerId)
        if (provider) {
          this.logger.log(
            `[Provider Debug] resolveModelConfig → using provider by ID: ` +
            `id=${provider.id}, name=${provider.name}, ` +
            `model=${provider.model}, base_url=${provider.base_url}, ` +
            `type=${provider.provider_type}, ` +
            `api_key=${this.#safeKeyPrefix(provider.api_key)}`
          )
          return {
            apiKey: provider.api_key,
            apiBaseUrl: provider.base_url,
            model: modelConfig.model || provider.model,
            temperature: modelConfig.temperature ?? 0.7,
            maxTokens: modelConfig.maxTokens ?? 1024
          }
        }
        this.logger.warn(`[Provider Debug] resolveModelConfig → providerId=${modelConfig.providerId} not found`)
      } catch (error) {
        this.logger.warn('Failed to load provider by ID:', error)
      }
    }

    // 2. 默认 Provider —— is_default=true
    try {
      const provider = await this.providerService.getDefaultProvider()
      if (provider) {
        this.logger.log(
          `[Provider Debug] resolveModelConfig → using default provider: ` +
          `name=${provider.name}, model=${provider.model}, ` +
          `base_url=${provider.base_url}, ` +
          `type=${provider.provider_type}, ` +
          `api_key=${this.#safeKeyPrefix(provider.api_key)}`
        )
        return {
          apiKey: provider.api_key,
          apiBaseUrl: provider.base_url,
          model: modelConfig?.model || provider.model,
          temperature: modelConfig?.temperature ?? 0.7,
          maxTokens: modelConfig?.maxTokens ?? 1024
        }
      }
    } catch (error) {
      this.logger.warn('Failed to load default provider, falling back to .env:', error)
    }

    // 3. .env 兜底
    this.logger.log(`[Provider Debug] resolveModelConfig → falling back to .env`)
    return {
      apiKey: this.configService.get<string>('LLM_API_KEY', ''),
      apiBaseUrl: this.configService.get<string>('LLM_BASE_URL', 'https://api.openai.com/v1'),
      model: modelConfig?.model || this.configService.get<string>('LLM_MODEL', 'gpt-4o'),
      temperature: modelConfig?.temperature ?? 0.7,
      maxTokens: modelConfig?.maxTokens ?? 1024
    }
  }

  /** 安全打印 Key 前缀 */
  #safeKeyPrefix(key?: string): string {
    if (!key) return '<empty>'
    if (key.length <= 8) return key.substring(0, 4) + '...'
    return key.substring(0, 8) + '...'
  }

  /**
   * 从用户消息中异步提取长期记忆（fire-and-forget）
   *
   * 流程：LLM 提取 → MySQL 存储（自动触发向量索引）
   * 完全异步，不阻塞 SSE 流式响应
   * 失败不影响聊天
   */
  private extractMemoriesFromMessage(
    userMessage: string,
    resolvedConfig: ResolvedModelConfig,
    runtimeConfig?: Partial<RuntimeModelConfig>
  ): void {
    this.logger.log(`[Memory] Extraction started for: "${userMessage.substring(0, 80)}"`)

    this.memoryExtractor
      .extractMemories(userMessage, resolvedConfig, runtimeConfig)
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
