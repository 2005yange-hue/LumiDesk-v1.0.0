/**
 * Embedding 提供者接口
 * 支持替换不同 Embedding 模型（OpenAI / 本地模型 / 其他 API）
 */
export interface EmbeddingProvider {
  /** 单条文本转向量（失败/disabeld 返回 null） */
  embed(text: string): Promise<number[] | null>

  /** 批量文本转向量（失败/disabeld 返回 null） */
  embedBatch(texts: string[]): Promise<number[][] | null>
}
