import { Injectable, Logger } from '@nestjs/common'
import { EmbeddingService } from './embedding/embedding.service'
import { ChromaClient, ChromaSearchResult } from './chroma/chroma.client'

/** 向量记忆搜索结果 */
export interface MemorySearchResult {
  content: string
  score: number
  type: string
}

/** 向量搜索超时时间（毫秒） */
const SEARCH_TIMEOUT_MS = 2000
/** 向量索引超时时间（毫秒，写入操作更宽松） */
const INDEX_TIMEOUT_MS = 10_000

/**
 * 向量记忆服务
 * 提供记忆向量化存储与语义搜索能力
 *
 * 流程：
 *   text → EmbeddingService → 向量 → ChromaClient → 存储
 *   query → EmbeddingService → 向量 → ChromaClient → 相似搜索
 *
 * 性能保障：
 *   - search() 最多 2s 超时，超时自动降级
 *   - 所有错误均静默降级，不影响主聊天流程
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
   * 带超时保护，失败不影响 MySQL 主流程
   */
  async indexMemory(
    memoryId: string,
    userId: string,
    content: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.withTimeout(
        this.doIndex(memoryId, userId, content, metadata),
        INDEX_TIMEOUT_MS,
        'indexMemory'
      )
    } catch (error) {
      this.logger.warn('Vector indexing failed (non-blocking):', error)
    }
  }

  private async doIndex(
    memoryId: string,
    userId: string,
    content: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const embedStart = Date.now()
    const embedding = await this.embeddingService.embed(content)
    this.logger.debug(`[indexMemory] embedding took ${Date.now() - embedStart}ms`)

    await this.chromaClient.addMemory({
      id: memoryId,
      userId,
      content,
      embedding,
      metadata
    })
    this.logger.debug(`Indexed memory: ${memoryId}`)
  }

  /**
   * 语义搜索相关记忆（带 2s 超时保护）
   * 超时或失败返回空数组，调用方降级 MySQL
   */
  async search(
    query: string,
    userId = 'default',
    topK?: number
  ): Promise<MemorySearchResult[]> {
    const totalStart = Date.now()

    try {
      const result = await this.withTimeout(
        this.doSearch(query, userId, topK),
        SEARCH_TIMEOUT_MS,
        'vector search'
      )
      this.logger.debug(`[search] total took ${Date.now() - totalStart}ms, returned ${result.length} results`)
      return result
    } catch (error) {
      const elapsed = Date.now() - totalStart
      this.logger.warn(`Vector search failed or timed out after ${elapsed}ms:`, error)
      return []
    }
  }

  /**
   * 实际执行语义搜索（不含超时包装）
   */
  private async doSearch(
    query: string,
    userId: string,
    topK?: number
  ): Promise<MemorySearchResult[]> {
    // 步骤 1：文本转向量
    const embedStart = Date.now()
    const embedding = await this.embeddingService.embed(query)
    this.logger.debug(`[search] embedding took ${Date.now() - embedStart}ms`)

    // 步骤 2：Chroma 相似度搜索
    const chromaStart = Date.now()
    const k = topK ?? 5
    const results = await this.chromaClient.searchSimilar(embedding, userId, k)
    this.logger.debug(`[search] chroma query took ${Date.now() - chromaStart}ms`)

    return results.map((r: ChromaSearchResult) => ({
      content: r.content,
      score: r.score,
      type: (r.metadata['type'] as string) || 'unknown'
    }))
  }

  /**
   * Promise 超时包装
   * @param promise  原始异步操作
   * @param ms       超时毫秒数
   * @param label    操作名称（日志用）
   */
  private withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`[${label}] timed out after ${ms}ms`)), ms)
      )
    ])
  }
}
