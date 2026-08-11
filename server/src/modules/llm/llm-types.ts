/**
 * LLM 模块共享类型定义
 * 独立于具体实现，供 chat 等消费方引用
 */

/** 运行时模型配置（可覆盖环境变量） */
export interface RuntimeModelConfig {
  apiKey: string
  apiBaseUrl: string
  model: string
  temperature: number
  maxTokens: number
}
