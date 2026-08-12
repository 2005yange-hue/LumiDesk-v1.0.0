import { Injectable, Logger } from '@nestjs/common'
import OpenAI from 'openai'
import {
  ILLMAdapter,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk
} from '../llm-adapter.interface'

/**
 * OpenAI 兼容适配器
 * 支持 OpenAI / DeepSeek / Qwen 等兼容 API
 */
@Injectable()
export class OpenAIAdapter implements ILLMAdapter {
  private readonly logger = new Logger(OpenAIAdapter.name)
  private client: OpenAI

  constructor(apiKey: string, baseURL?: string) {
    const resolvedBaseURL = baseURL || 'https://api.openai.com/v1'
    this.client = new OpenAI({
      apiKey,
      baseURL: resolvedBaseURL,
      timeout: 30000
    })
    this.logger.log(
      `[Provider Debug] OpenAIAdapter init → baseURL=${resolvedBaseURL}, ` +
      `api_key=${this.#safeKeyPrefix(apiKey)}`
    )
  }

  /** 安全打印 Key 前缀 */
  #safeKeyPrefix(key?: string): string {
    if (!key) return '<empty>'
    if (key.length <= 8) return key.substring(0, 4) + '...'
    return key.substring(0, 8) + '...'
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: request.model || 'gpt-4o',
        messages: request.messages.map((m) => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content
        })),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 1024,
        stream: false
      })

      const choice = response.choices[0]
      return {
        content: choice.message?.content || '',
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens
            }
          : undefined
      }
    } catch (error) {
      this.logger.error('OpenAI chat error:', error)
      throw error
    }
  }

  async chatStream(request: LLMRequest): Promise<AsyncIterable<LLMStreamChunk>> {
    const stream = await this.client.chat.completions.create({
      model: request.model || 'gpt-4o',
      messages: request.messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content
      })),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 1024,
      stream: true
    })

    return this.wrapStream(stream)
  }

  /**
   * 将 OpenAI 原生流包装为标准 AsyncIterable
   */
  private async *wrapStream(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
  ): AsyncIterable<LLMStreamChunk> {
    try {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || ''
        yield {
          content,
          done: chunk.choices[0]?.finish_reason === 'stop'
        }
      }
    } catch (error) {
      this.logger.error('Stream error:', error)
      throw error
    }
  }
}
