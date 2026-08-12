/** 会话摘要（列表项） */
export interface ConversationInfo {
  id: string
  title: string | null
  message_count: number
  created_at: string
  updated_at: string
}

/** 会话详情 */
export interface ConversationDetail extends ConversationInfo {
  user_id: string
  character_id: string | null
}

/** 消息记录 */
export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  token_count: number | null
  created_at: string
}

/** 分页消息响应 */
export interface PaginatedMessages {
  messages: ConversationMessage[]
  total: number
}

/** 创建会话参数 */
export interface CreateConversationParams {
  title?: string
}

/** 更新会话参数 */
export interface UpdateConversationParams {
  title: string
}
