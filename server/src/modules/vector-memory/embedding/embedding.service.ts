import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import { EmbeddingProvider } from './embedding.interface'

/**
 * OpenAI Compatible Embedding 服务
 *
 * 配置优先级：
 *   1. EMBEDDING_API_KEY / EMBEDDING_BASE_URL（独立配置）
 *   2. LLM_API_KEY / LLM_BASE_URL（回退复用 LLM 配置）
 *
 * 支持场景：
 *   - 官方 OpenAI Embedding API
 *   - 中转 API
 *   - 其他 OpenAI 兼容 Embedding 服务
 */
@Injectable()
export class EmbeddingService implements EmbeddingProvider {
  private readonly logger = new Logger(EmbeddingService.name)
  private client: OpenAI
  private model: string

  constructor(private readonly configService: ConfigService) {
    // 优先使用独立的 Embedding 配置，未配置则回退 LLM 配置
    const apiKey = this.resolveConfig('EMBEDDING_API_KEY', 'LLM_API_KEY')
    const baseURL = this.resolveConfig('EMBEDDING_BASE_URL', 'LLM_BASE_URL', 'https://api.openai.com/v1')
    this.model = this.configService.get<string>('EMBEDDING_MODEL', 'text-embedding-3-small')

    this.client = new OpenAI({ apiKey, baseURL, timeout: 30000 })
    this.logger.log(`EmbeddingService initialized | baseURL: ${baseURL} | model: ${this.model}`)
  }

  /**
   * 解析配置值：优先读取 primaryKey，为空则回退 fallbackKey
   */
  private resolveConfig(primaryKey: string, fallbackKey: string, defaultVal = ''): string {
    const primary = this.configService.get<string>(primaryKey, '')
    if (primary) return primary
    return this.configService.get<string>(fallbackKey, defaultVal)
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text])
    return results[0]
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: texts,
        encoding_format: 'float'
      })

      // 按输入顺序排序返回
      const sorted = response.data.sort((a, b) => a.index - b.index)
      return sorted.map((d) => d.embedding)
    } catch (error) {
      this.logger.error('Embedding API call failed:', error)
      throw error
    }
  }
}
