/** 单条聊天消息 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

/** 历史消息（发送给后端） */
export interface HistoryMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** SSE 流式响应块 */
export interface ChatStreamChunk {
  content?: string
  fullContent?: string
  done: boolean
  id?: string
  error?: string
}

/** 发送消息请求 */
export interface SendMessageRequest {
  content: string
  history?: HistoryMessage[]
}
