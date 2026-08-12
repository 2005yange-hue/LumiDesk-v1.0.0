import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import { EmbeddingProvider } from './embedding.interface'

/**
 * OpenAI Compatible Embedding 服务
 *
 * 独立配置，不复用 LLM 配置：
 *   EMBEDDING_API_KEY  — Embedding API 密钥
 *   EMBEDDING_BASE_URL — Embedding API 地址（OpenAI Compatible）
 *   EMBEDDING_MODEL    — 模型名称，默认 text-embedding-3-small
 *
 * 支持运行时动态切换配置（configure 方法），优先级：
 *   1. configure() 传入的配置
 *   2. .env 配置
 *
 * 安全降级：
 *   - 未配置 → 静默禁用
 *   - API 请求超时（5s）或失败 → 返回空向量，记录 warn
 */
@Injectable()
export class EmbeddingService implements EmbeddingProvider {
  private readonly logger = new Logger(EmbeddingService.name)
  private client: OpenAI | null = null
  private model: string

  constructor(private readonly configService: ConfigService) {
    this.model = this.configService.get<string>('EMBEDDING_MODEL', 'text-embedding-3-small')
    this.initFromEnv()
  }

  /**
   * 从环境变量初始化客户端
   */
  private initFromEnv(): void {
    const apiKey = this.configService.get<string>('EMBEDDING_API_KEY', '')
    const baseURL = this.configService.get<string>('EMBEDDING_BASE_URL', '')

    if (apiKey && baseURL) {
      this.client = new OpenAI({ apiKey, baseURL, timeout: 5000 })
      this.logger.log(`[EmbeddingService] baseURL: ${baseURL} | model: ${this.model}`)
    } else {
      this.client = null
      this.logger.warn(`[EmbeddingService] Not configured (apiKey=${!!apiKey}, baseURL=${!!baseURL}), embedding disabled`)
    }
  }

  /**
   * 运行时动态切换 Embedding 配置
   * 用于从 DB Provider 或前端选择不同 Embedding 服务
   */
  configure(apiKey: string, baseURL: string, model?: string): void {
    if (!apiKey || !baseURL) {
      this.client = null
      this.logger.warn('[EmbeddingService] configure() called with empty config, embedding disabled')
      return
    }

    this.client = new OpenAI({ apiKey, baseURL, timeout: 5000 })
    if (model) this.model = model
    this.logger.log(`[EmbeddingService] Configured | baseURL: ${baseURL} | model: ${this.model}`)
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text])
    return results[0] || []
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.client) {
      return texts.map(() => [])
    }

    const start = Date.now()
    const totalChars = texts.reduce((sum, t) => sum + t.length, 0)

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: texts,
        encoding_format: 'float'
      })

      const sorted = response.data.sort((a, b) => a.index - b.index)
      const elapsed = Date.now() - start
      this.logger.debug(`[Embedding] ${texts.length} texts (${totalChars} chars) took ${elapsed}ms`)

      return sorted.map((d) => d.embedding)
    } catch (error) {
      const elapsed = Date.now() - start
      this.logger.warn(`[EmbeddingService] API call failed after ${elapsed}ms: ${error}`)
      return texts.map(() => [])
    }
  }
}
