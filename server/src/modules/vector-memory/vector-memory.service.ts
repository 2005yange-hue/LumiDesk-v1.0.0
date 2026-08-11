import { Injectable, Logger } from '@nestjs/common'
import { EmbeddingService } from './embedding/embedding.service'
import { ChromaClient, ChromaSearchResult } from './chroma/chroma.client'

/** 向量记忆搜索结果 */
export interface MemorySearchResult {
  content: string
  score: number
  type: string
}

/**
 * 向量记忆服务
 * 提供记忆向量化存储与语义搜索能力
 *
 * 流程：
 *   text → EmbeddingService → 向量 → ChromaClient → 存储
 *   query → EmbeddingService → 向量 → ChromaClient → 相似搜索
 *
 * 所有错误均静默降级，不影响主聊天流程
 */
@Injectable()
export class VectorMemoryService {
  private readonly logger = new Logger(VectorMemoryService.name)

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly chromaClient: ChromaClient
  ) {}

  /**
   * 将记忆向量化并存储到 ChromaDB
   * @param memoryId  MySQL 中的记忆 ID
   * @param userId    用户 ID
   * @param content   记忆文本内容
   * @param metadata  附加元数据（type, importance 等）
   */
  async indexMemory(
    memoryId: string,
    userId: string,
    content: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      const embedding = await this.embeddingService.embed(content)
      await this.chromaClient.addMemory({
        id: memoryId,
        userId,
        content,
        embedding,
        metadata
      })
      this.logger.debug(`Indexed memory: ${memoryId}`)
    } catch (error) {
      // 向量化失败不影响 MySQL 主流程
      this.logger.warn('Vector indexing failed (non-blocking):', error)
    }
  }

  /**
   * 语义搜索相关记忆
   * @param query  用户查询文本
   * @param userId 用户 ID
   * @param topK   返回 Top K 结果
   * @returns 按相关性排序的记忆列表
   */
  async search(
    query: string,
    userId = 'default',
    topK?: number
  ): Promise<MemorySearchResult[]> {
    try {
      const embedding = await this.embeddingService.embed(query)
      const k = topK ?? 5
      const results = await this.chromaClient.searchSimilar(embedding, userId, k)

      return results.map((r: ChromaSearchResult) => ({
        content: r.content,
        score: r.score,
        type: (r.metadata['type'] as string) || 'unknown'
      }))
    } catch (error) {
      this.logger.warn('Vector search failed:', error)
      return []
    }
  }
}
