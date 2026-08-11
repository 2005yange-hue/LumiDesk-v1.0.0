import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/** ChromaDB 写入参数 */
export interface ChromaMemoryPayload {
  id: string
  userId: string
  content: string
  embedding: number[]
  metadata: Record<string, unknown>
}

/** ChromaDB 搜索返回 */
export interface ChromaSearchResult {
  id: string
  content: string
  metadata: Record<string, unknown>
  score: number
}

/**
 * ChromaDB REST API 客户端
 * 管理 AI 记忆的向量存储与语义检索
 */
@Injectable()
export class ChromaService {
  private readonly logger = new Logger(ChromaService.name)
  private readonly baseUrl: string
  private collectionId: string | null = null

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('CHROMA_URL', 'http://localhost:8000')
  }

  private get collectionName(): string {
    return this.configService.get<string>('VECTOR_COLLECTION', 'memory_entries')
  }

  /**
   * 确保 Collection 存在（惰性创建）
   */
  private async ensureCollection(): Promise<string> {
    if (this.collectionId) return this.collectionId

    try {
      const existing = await this.fetchJson<Array<{ id: string; name: string }>>(
        `${this.baseUrl}/api/v1/collections`
      )

      const found = existing?.find((c) => c.name === this.collectionName)
      if (found) {
        this.collectionId = found.id
        this.logger.log(`[Chroma] Found collection: ${this.collectionName}`)
        return found.id
      }
    } catch {
      // 获取失败，尝试直接创建
    }

    const created = await this.fetchJson<{ id: string }>(
      `${this.baseUrl}/api/v1/collections`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: this.collectionName,
          metadata: { description: 'AI companion long-term memory vectors' }
        })
      }
    )

    this.collectionId = created.id
    this.logger.log(`[Chroma] Created collection: ${this.collectionName}`)
    return created.id
  }

  /**
   * 添加记忆向量到 ChromaDB
   */
  async addMemory(payload: ChromaMemoryPayload): Promise<void> {
    const collectionId = await this.ensureCollection()

    await this.fetchJson(`${this.baseUrl}/api/v1/collections/${collectionId}/add`, {
      method: 'POST',
      body: JSON.stringify({
        ids: [payload.id],
        embeddings: [payload.embedding],
        metadatas: [{ ...payload.metadata, userId: payload.userId }],
        documents: [payload.content]
      })
    })

    this.logger.log(`[Chroma] Stored vector for memory: ${payload.id}`)
  }

  /**
   * 语义相似度搜索
   */
  async searchSimilar(
    queryEmbedding: number[],
    userId: string,
    topK = 5
  ): Promise<ChromaSearchResult[]> {
    const collectionId = await this.ensureCollection()

    const result = await this.fetchJson<{
      ids: string[][]
      documents: string[][]
      metadatas: Array<Array<Record<string, unknown>>>
      distances: number[][]
    }>(`${this.baseUrl}/api/v1/collections/${collectionId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        query_embeddings: [queryEmbedding],
        n_results: topK,
        where: { userId },
        include: ['documents', 'metadatas', 'distances']
      })
    })

    const ids = result.ids?.[0]
    if (!ids) return []

    return ids.map((id, i) => ({
      id,
      content: result.documents?.[0]?.[i] || '',
      metadata: result.metadatas?.[0]?.[i] || {},
      score: 1 - (result.distances?.[0]?.[i] || 0)
    }))
  }

  private async fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`ChromaDB HTTP ${res.status}: ${text}`)
    }

    return res.json() as Promise<T>
  }
}
