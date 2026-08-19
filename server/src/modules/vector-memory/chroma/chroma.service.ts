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

/** ChromaDB 记忆向量更新参数 */
export interface ChromaMemoryUpdatePayload {
  id: string
  content?: string
  embedding?: number[]
  metadata?: Record<string, unknown>
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
  private readonly enabled: boolean
  private collectionId: string | null = null

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('CHROMA_URL', 'http://localhost:8000').replace(/\/$/, '')
    this.enabled = this.configService.get<string>('VECTOR_DB_PROVIDER', 'disabled').toLowerCase() === 'chroma'
  }

  isEnabled(): boolean { return this.enabled }

  private get apiVersion(): string {
    return this.configService.get<string>('CHROMA_API_VERSION', 'v2')
  }

  private get collectionName(): string {
    return this.configService.get<string>('VECTOR_COLLECTION', 'memory_entries')
  }

  /** Chroma v2 完整的 collections 基础路径 */
  private get collectionsBasePath(): string {
    return `${this.baseUrl}/api/${this.apiVersion}/tenants/default_tenant/databases/default_database/collections`
  }

  /**
   * 确保 Collection 存在（惰性创建）
   */
  private async ensureCollection(): Promise<string> {
    if (this.collectionId) return this.collectionId

    try {
      const existing = await this.fetchJson<Array<{ id: string; name: string }>>(
        this.collectionsBasePath
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
      this.collectionsBasePath,
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

    await this.fetchJson(`${this.collectionsBasePath}/${collectionId}/add`, {
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

  /** 更新已有记忆向量的文档、Embedding 或 metadata。 */
  async updateMemory(payload: ChromaMemoryUpdatePayload): Promise<void> {
    const collectionId = await this.ensureCollection()
    const body: Record<string, unknown> = { ids: [payload.id] }

    if (payload.embedding) body.embeddings = [payload.embedding]
    if (payload.content !== undefined) body.documents = [payload.content]
    if (payload.metadata !== undefined) body.metadatas = [payload.metadata]

    await this.fetchJson(`${this.collectionsBasePath}/${collectionId}/update`, {
      method: 'POST',
      body: JSON.stringify(body)
    })

    this.logger.log(`[Chroma] Updated vector for memory: ${payload.id}`)
  }

  /** 删除已有记忆向量。 */
  async deleteMemory(id: string): Promise<void> {
    const collectionId = await this.ensureCollection()

    await this.fetchJson(`${this.collectionsBasePath}/${collectionId}/delete`, {
      method: 'POST',
      body: JSON.stringify({ ids: [id] })
    })

    this.logger.log(`[Chroma] Deleted vector for memory: ${id}`)
  }

  /**
   * 语义相似度搜索
   */
  async searchSimilar(
    queryEmbedding: number[],
    userId: string,
    topK = 5,
    characterId?: string
  ): Promise<ChromaSearchResult[]> {
    const collectionId = await this.ensureCollection()

    const result = await this.fetchJson<{
      ids: string[][]
      documents: string[][]
      metadatas: Array<Array<Record<string, unknown>>>
      distances: number[][]
    }>(`${this.collectionsBasePath}/${collectionId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        query_embeddings: [queryEmbedding],
        n_results: topK,
        where: characterId
          ? { $and: [{ userId }, { characterId }] }
          : { userId },
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
