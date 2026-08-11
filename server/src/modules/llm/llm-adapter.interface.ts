import { Stream } from 'openai/streaming'

/** LLM 请求参数 */
export interface LLMRequest {
  messages: LLMMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

/** 单条消息 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** LLM 流式响应块 */
export interface LLMStreamChunk {
  content: string
  done: boolean
}

/** LLM 完整响应 */
export interface LLMResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * LLM 适配器接口
 * 所有模型厂商需实现此接口
 */
export interface ILLMAdapter {
  /** 非流式对话 */
  chat(request: LLMRequest): Promise<LLMResponse>

  /** 流式对话 - 返回异步可迭代对象 */
  chatStream(request: LLMRequest): Promise<AsyncIterable<LLMStreamChunk>>
}
