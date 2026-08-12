/**
 * LLM 模块共享类型定义
 * 独立于具体实现，供 chat 等消费方引用
 */

/** 运行时模型配置（前端传入，不含凭据） */
export interface RuntimeModelConfig {
  /** Provider ID：指定使用哪个已配置的 API Provider */
  providerId?: number
  model?: string
  temperature?: number
  maxTokens?: number
}

/** 服务层内部使用的已解析配置（含凭据，前端不可见） */
export interface ResolvedModelConfig {
  apiKey: string
  apiBaseUrl: string
  model: string
  temperature: number
  maxTokens: number
}
