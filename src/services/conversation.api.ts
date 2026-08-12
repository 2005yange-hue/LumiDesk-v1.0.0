import axios from 'axios'
import type {
  ConversationInfo,
  ConversationDetail,
  PaginatedMessages,
  CreateConversationParams,
  UpdateConversationParams
} from '@/types/conversation.types'

const BASE = '/api/conversations'

/** 获取会话列表 */
export async function getConversations(): Promise<ConversationInfo[]> {
  const { data } = await axios.get(BASE)
  return data.data
}

/** 获取会话详情 */
export async function getConversation(id: string): Promise<ConversationDetail> {
  const { data } = await axios.get(`${BASE}/${id}`)
  return data.data
}

/** 分页获取会话历史消息 */
export async function getMessages(
  id: string,
  page = 1,
  limit = 50
): Promise<PaginatedMessages> {
  const { data } = await axios.get(`${BASE}/${id}/messages`, { params: { page, limit } })
  return data.data
}

/** 创建新会话 */
export async function createConversation(
  params: CreateConversationParams
): Promise<ConversationDetail> {
  const { data } = await axios.post(BASE, params)
  return data.data
}

/** 更新会话标题 */
export async function updateConversation(
  id: string,
  params: UpdateConversationParams
): Promise<ConversationDetail> {
  const { data } = await axios.patch(`${BASE}/${id}`, params)
  return data.data
}

/** 删除会话 */
export async function deleteConversation(id: string): Promise<void> {
  await axios.delete(`${BASE}/${id}`)
}
