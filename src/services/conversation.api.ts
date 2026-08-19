import axios from 'axios'
import type { ConversationInfo, ConversationMessage } from '@/types/conversation.types'

interface Wrapped<T> { success: boolean; data: T }
export interface ConversationMutationResult { content: string; deletedCount: number; remainingCount: number }

export async function getConversations(): Promise<ConversationInfo[]> { return (await axios.get<Wrapped<ConversationInfo[]>>('/api/conversations')).data.data }
export async function getMessages(id: string, page = 1, limit = 50): Promise<{ messages: ConversationMessage[]; total: number }> { return (await axios.get<Wrapped<{ messages: ConversationMessage[]; total: number }>>('/api/conversations/' + id + '/messages', { params: { page, limit } })).data.data }
export async function createConversation(data: { title?: string } = {}): Promise<ConversationInfo> { return (await axios.post<Wrapped<ConversationInfo>>('/api/conversations', data)).data.data }
export async function updateConversation(id: string, data: { title: string }): Promise<ConversationInfo> { return (await axios.patch<Wrapped<ConversationInfo>>('/api/conversations/' + id, data)).data.data }
export async function deleteConversation(id: string): Promise<void> { await axios.delete('/api/conversations/' + id) }
export async function prepareMessageEdit(conversationId: string, messageId: string, content: string): Promise<ConversationMutationResult> { return (await axios.patch<Wrapped<ConversationMutationResult>>('/api/conversations/' + conversationId + '/messages/' + messageId, { content })).data.data }
export async function prepareMessageRegenerate(conversationId: string, messageId: string): Promise<ConversationMutationResult> { return (await axios.post<Wrapped<ConversationMutationResult>>('/api/conversations/' + conversationId + '/messages/' + messageId + '/regenerate')).data.data }
export async function deleteFromMessage(conversationId: string, messageId: string): Promise<ConversationMutationResult> { return (await axios.delete<Wrapped<ConversationMutationResult>>('/api/conversations/' + conversationId + '/messages/' + messageId)).data.data }
export async function exportConversation(conversationId: string, format: 'markdown' | 'json'): Promise<{ filename: string; content: string; mimeType: string }> { return (await axios.get<Wrapped<{ filename: string; content: string; mimeType: string }>>('/api/conversations/' + conversationId + '/export', { params: { format } })).data.data }
