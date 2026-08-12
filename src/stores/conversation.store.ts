import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ConversationInfo, ConversationMessage } from '@/types/conversation.types'
import {
  getConversations,
  getMessages,
  createConversation,
  updateConversation,
  deleteConversation
} from '@/services/conversation.api'

const CURRENT_ID_KEY = 'conversation_current_id'

function loadCurrentId(): string | null {
  return localStorage.getItem(CURRENT_ID_KEY)
}

export const useConversationStore = defineStore('conversation', () => {
  // ──── 状态 ────
  const conversationList = ref<ConversationInfo[]>([])
  const currentConversationId = ref<string | null>(loadCurrentId())
  const loading = ref(false)
  const messagesLoading = ref(false)

  // ──── 持久化当前会话 ID ────
  function saveCurrentId(id: string | null): void {
    currentConversationId.value = id
    if (id) {
      localStorage.setItem(CURRENT_ID_KEY, id)
    } else {
      localStorage.removeItem(CURRENT_ID_KEY)
    }
  }

  // ──── 加载会话列表（含当前会话状态调和） ────
  async function fetchList(): Promise<void> {
    loading.value = true
    try {
      conversationList.value = await getConversations()

      // 当前会话状态恢复：
      // - 保存的会话仍存在 → 保持
      // - 保存的会话已不存在 → 清除并自动选择最近会话（无会话则不自动创建）
      if (currentConversationId.value) {
        const exists = conversationList.value.some(
          (c) => c.id === currentConversationId.value
        )
        if (!exists) {
          if (conversationList.value.length > 0) {
            saveCurrentId(conversationList.value[0].id)
          } else {
            saveCurrentId(null)
          }
        }
      }
    } catch {
      conversationList.value = []
    } finally {
      loading.value = false
    }
  }

  // ──── 创建会话 ────
  async function create(title?: string): Promise<ConversationInfo | null> {
    try {
      const conv = await createConversation(title ? { title } : {})
      await fetchList()
      saveCurrentId(conv.id)
      return conv
    } catch {
      return null
    }
  }

  // ──── 删除会话 ────
  async function remove(id: string): Promise<boolean> {
    try {
      await deleteConversation(id)
      // 不提前清空 currentConversationId，交由 fetchList 的调和逻辑：
      // 若删除的是当前会话，fetchList 检测到保存的 id 不存在后会自动选择最近会话
      await fetchList()
      return true
    } catch {
      return false
    }
  }

  // ──── 更新会话标题 ────
  async function updateTitle(id: string, title: string): Promise<boolean> {
    try {
      await updateConversation(id, { title })
      await fetchList()
      return true
    } catch {
      return false
    }
  }

  // ──── 加载会话历史消息 ────
  async function loadMessages(
    id: string,
    page = 1,
    limit = 50
  ): Promise<{ messages: ConversationMessage[]; total: number } | null> {
    messagesLoading.value = true
    try {
      const result = await getMessages(id, page, limit)
      saveCurrentId(id)
      return result
    } catch {
      return null
    } finally {
      messagesLoading.value = false
    }
  }

  // ──── 切换当前会话 ────
  function selectConversation(id: string): void {
    saveCurrentId(id)
  }

  // ──── 清空当前会话选择 ────
  function clearSelection(): void {
    saveCurrentId(null)
  }

  return {
    conversationList,
    currentConversationId,
    loading,
    messagesLoading,
    fetchList,
    create,
    remove,
    updateTitle,
    loadMessages,
    selectConversation,
    clearSelection,
    saveCurrentId
  }
})
