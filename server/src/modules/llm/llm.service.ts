import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ILLMAdapter, LLMRequest, LLMResponse, LLMStreamChunk, LLMMessage } from './llm-adapter.interface'
import { OpenAIAdapter } from './adapters/openai.adapter'
import { RuntimeModelConfig, ResolvedModelConfig } from './llm-types'

export { RuntimeModelConfig, ResolvedModelConfig }

/**
 * LLM 调度服务
 * 支持环境变量默认配置 + 凭据注入
 */
@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name)
  private adapterCache = new Map<string, ILLMAdapter>()

  constructor(private readonly configService: ConfigService) {}

  /**
   * 获取默认配置（.env 兜底）
   */
  private getDefaultConfig(): ResolvedModelConfig {
    const apiKey = this.configService.get<string>('LLM_API_KEY', '')
    const apiBaseUrl = this.configService.get<string>('LLM_BASE_URL', 'https://api.openai.com/v1')
    const model = this.configService.get<string>('LLM_MODEL', 'gpt-4o')
    this.logger.log(
      `[Provider Debug] getDefaultConfig → model=${model}, ` +
      `baseURL=${apiBaseUrl}, ` +
      `api_key=${this.#safeKeyPrefix(apiKey)}`
    )
    return {
      apiKey,
      apiBaseUrl,
      model,
      temperature: 0.7,
      maxTokens: 1024
    }
  }

  /**
   * 获取或创建适配器
   * 按 apiKey+baseURL 缓存，避免重复创建
   */
  private getAdapter(apiKey: string, baseURL: string): ILLMAdapter {
    const cacheKey = `${apiKey}:${baseURL}`
    if (!this.adapterCache.has(cacheKey)) {
      this.logger.log(
        `[Provider Debug] getAdapter → creating new adapter: ` +
        `baseURL=${baseURL}, api_key=${this.#safeKeyPrefix(apiKey)}`
      )
      this.adapterCache.set(cacheKey, new OpenAIAdapter(apiKey, baseURL))
    }
    return this.adapterCache.get(cacheKey)!
  }

  /** 安全打印 Key 前缀 */
  #safeKeyPrefix(key?: string): string {
    if (!key) return '<empty>'
    if (key.length <= 8) return key.substring(0, 4) + '...'
    return key.substring(0, 8) + '...'
  }

  /**
   * 非流式对话（用于记忆提取等场景）
   * @param messages 消息列表
   * @param runtimeConfig 前端传入的运行时配置（可用于覆盖 model/temperature）
   */
  async chat(
    messages: LLMMessage[],
    resolvedConfig: ResolvedModelConfig,
    runtimeConfig?: Partial<RuntimeModelConfig>
  ): Promise<LLMResponse> {
    const config: ResolvedModelConfig = {
      ...resolvedConfig,
      model: runtimeConfig?.model || resolvedConfig.model,
      temperature: runtimeConfig?.temperature ?? resolvedConfig.temperature,
      maxTokens: runtimeConfig?.maxTokens ?? resolvedConfig.maxTokens
    }

    if (!config.apiKey) {
      throw new Error('LLM_API_KEY not configured. 请在设置中配置 API Key')
    }

    this.logger.log(
      `[Provider Debug] chat → model=${config.model}, ` +
      `baseURL=${config.apiBaseUrl}, ` +
      `api_key=${this.#safeKeyPrefix(config.apiKey)}`
    )

    const adapter = this.getAdapter(config.apiKey, config.apiBaseUrl)

    const request: LLMRequest = {
      messages,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens
    }

    return adapter.chat(request)
  }

  /**
   * 流式对话
   * @param messages 消息列表
   * @param resolvedConfig 已解析的配置（含凭据）
   * @param runtimeConfig 前端传入的运行时覆盖（model/temperature/maxTokens）
   */
  async chatStream(
    messages: LLMMessage[],
    resolvedConfig: ResolvedModelConfig,
    runtimeConfig?: Partial<RuntimeModelConfig>
  ): Promise<AsyncIterable<LLMStreamChunk>> {
    const config: ResolvedModelConfig = {
      ...resolvedConfig,
      model: runtimeConfig?.model || resolvedConfig.model,
      temperature: runtimeConfig?.temperature ?? resolvedConfig.temperature,
      maxTokens: runtimeConfig?.maxTokens ?? resolvedConfig.maxTokens
    }

    if (!config.apiKey) {
      throw new Error('LLM_API_KEY not configured. 请在设置中配置 API Key')
    }

    this.logger.log(
      `[Provider Debug] chatStream → model=${config.model}, ` +
      `baseURL=${config.apiBaseUrl}, ` +
      `api_key=${this.#safeKeyPrefix(config.apiKey)}`
    )

    const adapter = this.getAdapter(config.apiKey, config.apiBaseUrl)

    const request: LLMRequest = {
      messages,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens
    }

    return adapter.chatStream(request)
  }
}
