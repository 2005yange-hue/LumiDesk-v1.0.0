import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import { EmbeddingProvider } from './embedding.interface'

/**
 * OpenAI Embedding 服务
 * 复用项目已有的 LLM Provider 配置（apiKey / baseURL）
 */
@Injectable()
export class EmbeddingService implements EmbeddingProvider {
  private readonly logger = new Logger(EmbeddingService.name)
  private client: OpenAI

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('LLM_API_KEY', '')
    const baseURL = this.configService.get<string>('LLM_BASE_URL', 'https://api.openai.com/v1')
    this.client = new OpenAI({ apiKey, baseURL, timeout: 30000 })
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text])
    return results[0]
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const model = this.configService.get<string>('EMBEDDING_MODEL', 'text-embedding-3-small')

    try {
      const response = await this.client.embeddings.create({
        model,
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
