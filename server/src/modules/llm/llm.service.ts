import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ILLMAdapter, LLMRequest, LLMResponse, LLMStreamChunk, LLMMessage } from './llm-adapter.interface'
import { OpenAIAdapter } from './adapters/openai.adapter'

/** 运行时模型配置（可覆盖环境变量） */
export interface RuntimeModelConfig {
  apiKey: string
  apiBaseUrl: string
  model: string
  temperature: number
  maxTokens: number
}

/**
 * LLM 调度服务
 * 支持环境变量默认配置 + 前端运行时配置覆盖
 */
@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name)
  private adapterCache = new Map<string, ILLMAdapter>()

  constructor(private readonly configService: ConfigService) {}

  /**
   * 获取或创建适配器
   * 按 apiKey+baseURL 缓存，避免重复创建
   */
  private getAdapter(apiKey: string, baseURL: string): ILLMAdapter {
    const cacheKey = `${apiKey}:${baseURL}`
    if (!this.adapterCache.has(cacheKey)) {
      this.adapterCache.set(cacheKey, new OpenAIAdapter(apiKey, baseURL))
      this.logger.log(`Created adapter for: ${baseURL}`)
    }
    return this.adapterCache.get(cacheKey)!
  }

  /** 从环境变量获取默认 API Key */
  private getEnvApiKey(): string {
    return this.configService.get<string>('LLM_API_KEY', '')
  }

  /** 从环境变量获取默认 Base URL */
  private getEnvBaseUrl(): string {
    return this.configService.get<string>('LLM_BASE_URL', 'https://api.openai.com/v1')
  }

  /** 从环境变量获取默认模型 */
  private getEnvModel(): string {
    return this.configService.get<string>('LLM_MODEL', 'gpt-4o')
  }

  /**
   * 合并环境变量 + 运行时配置
   */
  private resolveConfig(runtime?: Partial<RuntimeModelConfig>): RuntimeModelConfig {
    return {
      apiKey: runtime?.apiKey || this.getEnvApiKey(),
      apiBaseUrl: runtime?.apiBaseUrl || this.getEnvBaseUrl(),
      model: runtime?.model || this.getEnvModel(),
      temperature: runtime?.temperature ?? 0.7,
      maxTokens: runtime?.maxTokens ?? 1024
    }
  }

  async chat(
    messages: LLMMessage[],
    runtimeConfig?: Partial<RuntimeModelConfig>
  ): Promise<LLMResponse> {
    const config = this.resolveConfig(runtimeConfig)

    if (!config.apiKey) {
      throw new Error('LLM_API_KEY not configured. 请在设置中配置 API Key')
    }

    const adapter = this.getAdapter(config.apiKey, config.apiBaseUrl)

    const request: LLMRequest = {
      messages,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens
    }

    return adapter.chat(request)
  }

  async chatStream(
    messages: LLMMessage[],
    runtimeConfig?: Partial<RuntimeModelConfig>
  ): Promise<AsyncIterable<LLMStreamChunk>> {
    const config = this.resolveConfig(runtimeConfig)

    if (!config.apiKey) {
      throw new Error('LLM_API_KEY not configured. 请在设置中配置 API Key')
    }

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
