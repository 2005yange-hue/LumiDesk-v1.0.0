import { Injectable, Logger } from '@nestjs/common'
import { EmbeddingService } from './embedding/embedding.service'
import { ChromaService, ChromaSearchResult } from './chroma/chroma.service'

/** 向量记忆搜索结果 */
export interface MemorySearchResult {
  memoryId: string
  content: string
  score: number
  type: string
  importance: number | null
  confidence: number | null
  memoryScore: number | null
  status: string | null
}

/** Embedding 超时时间（毫秒） */
const EMBEDDING_TIMEOUT_MS = 5000
/** 向量索引超时时间（毫秒，写入操作更宽松） */
const INDEX_TIMEOUT_MS = 10_000

/**
 * 向量记忆服务
 * 提供记忆向量化存储与语义搜索能力
 *
 * 流程：
 *   MemoryEntry → EmbeddingService → ChromaService → 存储
 *   query → EmbeddingService → ChromaService → 相似搜索
 *
 * 性能保障：
 *   - embedding 最多 5s 超时
 *   - 所有错误均静默降级，不影响主聊天流程
 */
@Injectable()
export class VectorMemoryService {
  private readonly logger = new Logger(VectorMemoryService.name)

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly chromaService: ChromaService
  ) {}

  /**
   * 将 MemoryEntry 向量化并存储到 ChromaDB
   * 返回 Chroma 中的向量 ID，失败返回 null
   */
  async indexMemory(
    memoryId: string,
    userId: string,
    content: string,
    metadata: Record<string, unknown>
  ): Promise<string | null> {
    if (!this.chromaService.isEnabled()) return null
    this.logger.log(`[VectorMemory] index memory id=${memoryId}`)

    try {
      await this.withTimeout(
        this.doIndex(memoryId, userId, content, metadata),
        INDEX_TIMEOUT_MS,
        'indexMemory'
      )
      return memoryId
    } catch (error) {
      this.logger.warn(`[VectorMemory] index failed for memory id=${memoryId}:`, error)
      return null
    }
  }

  /** 更新已有记忆的向量内容或 metadata，失败时抛出异常供管理接口处理。 */
  async updateMemory(
    memoryId: string,
    userId: string,
    content: string,
    metadata: Record<string, unknown>,
    contentChanged: boolean,
    hasVector: boolean
  ): Promise<string> {
    if (!this.chromaService.isEnabled()) return memoryId
    const embedding = contentChanged || !hasVector
      ? await this.getEmbedding(content)
      : undefined

    if (!hasVector) {
      if (!embedding) {
        throw new Error('Embedding 不可用，无法创建记忆向量')
      }

      await this.chromaService.addMemory({
        id: memoryId,
        userId,
        content,
        embedding,
        metadata
      })
      return memoryId
    }

    await this.chromaService.updateMemory({
      id: memoryId,
      content: contentChanged ? content : undefined,
      embedding,
      metadata: { ...metadata, userId }
    })
    return memoryId
  }

  /** 删除记忆向量，失败时抛出异常供管理接口记录同步状态。 */
  async deleteMemory(vectorId: string): Promise<void> {
    if (!this.chromaService.isEnabled()) return
    await this.chromaService.deleteMemory(vectorId)
  }

  private async doIndex(
    memoryId: string,
    userId: string,
    content: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    this.logger.log('[Embedding] request start')

    const embedStart = Date.now()
    const embedding = await this.withTimeout(
      this.embeddingService.embed(content),
      EMBEDDING_TIMEOUT_MS,
      'embedding'
    )

    if (!embedding || embedding.length === 0) {
      this.logger.warn(`[Embedding] skipped: embedding unavailable (${Date.now() - embedStart}ms)`)
      return
    }

    this.logger.log(`[Embedding] success dimension=${embedding.length} (${Date.now() - embedStart}ms)`)

    await this.chromaService.addMemory({
      id: memoryId,
      userId,
      content,
      embedding,
      metadata
    })

    this.logger.log(`[VectorMemory] stored in chroma memory id=${memoryId}`)
  }

  /**
   * 语义搜索相关记忆（带超时保护）
   * 超时或失败返回空数组，调用方降级 MySQL
   */
  async search(
    query: string,
    userId = 'default',
    topK?: number,
    characterId?: string
  ): Promise<MemorySearchResult[]> {
    if (!this.chromaService.isEnabled()) return []
    const totalStart = Date.now()
    this.logger.log(`[VectorMemory] search query: "${query.substring(0, 80)}"`)

    try {
      const result = await this.withTimeout(
        this.doSearch(query, userId, topK, characterId),
        EMBEDDING_TIMEOUT_MS,
        'vector search'
      )
      this.logger.log(`[VectorMemory] found ${result.length} memories (${Date.now() - totalStart}ms)`)
      return result
    } catch (error) {
      this.logger.warn(`[VectorMemory] search failed after ${Date.now() - totalStart}ms:`, error)
      return []
    }
  }

  private async doSearch(
    query: string,
    userId: string,
    topK?: number,
    characterId?: string
  ): Promise<MemorySearchResult[]> {
    this.logger.log('[Embedding] request start')

    const embedStart = Date.now()
    const embedding = await this.withTimeout(
      this.embeddingService.embed(query),
      EMBEDDING_TIMEOUT_MS,
      'embedding'
    )

    if (!embedding || embedding.length === 0) {
      this.logger.warn(`[Embedding] skipped: embedding unavailable (${Date.now() - embedStart}ms)`)
      return []
    }

    this.logger.log(`[Embedding] success dimension=${embedding.length} (${Date.now() - embedStart}ms)`)

    const k = topK ?? 5
    const results = await this.chromaService.searchSimilar(embedding, userId, k, characterId)

    return results.map((r: ChromaSearchResult) => ({
      memoryId: r.id,
      content: r.content,
      score: r.score,
      type: (r.metadata['type'] as string) || 'unknown',
      importance: typeof r.metadata['importance'] === 'number' ? r.metadata['importance'] : null,
      confidence: typeof r.metadata['confidence'] === 'number' ? r.metadata['confidence'] : null,
      memoryScore: typeof r.metadata['memoryScore'] === 'number' ? r.metadata['memoryScore'] : null,
      status: typeof r.metadata['status'] === 'string' ? r.metadata['status'] : null
    }))
  }

  private async getEmbedding(content: string): Promise<number[]> {
    const embedding = await this.withTimeout(
      this.embeddingService.embed(content),
      EMBEDDING_TIMEOUT_MS,
      'embedding'
    )

    if (!embedding || embedding.length === 0) {
      throw new Error('Embedding 不可用，无法更新记忆向量')
    }

    return embedding
  }

  /**
   * Promise 超时包装
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
