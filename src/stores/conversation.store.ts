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

  // ──── 调和当前会话选择 ────
  // 规则：
  // 1. 无任何会话 → currentConversationId 置空
  // 2. localStorage 保存的会话仍存在 → 保持
  // 3. 无保存或保存的会话已失效 → 选择 updated_at 最新的一条
  //    （后端 listConversations 已按 updated_at DESC 排序，list[0] 即最新）
  function reconcileSelection(): void {
    const list = conversationList.value
    if (list.length === 0) {
      saveCurrentId(null)
      return
    }
    const saved = currentConversationId.value
    const exists = saved ? list.some((c) => c.id === saved) : false
    if (!exists) {
      saveCurrentId(list[0].id)
    }
  }

  // ──── 加载会话列表（含当前会话状态调和） ────
  async function fetchList(): Promise<boolean> {
    loading.value = true
    try {
      let data: ConversationInfo[] | null = null
      let lastError: unknown = null
      // 启动阶段后端可能尚未就绪，做有界重试，避免首次加载失败后列表永远为空
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          data = await getConversations()
          break
        } catch (err) {
          lastError = err
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
          }
        }
      }
      if (data === null) throw lastError

      conversationList.value = data
      reconcileSelection()
      return true
    } catch (err) {
      console.error('[Conversation] fetchList error', err)
      // 失败时保留已有列表，避免启动失败后误清空已加载数据
      return false
    } finally {
      loading.value = false
    }
  }

  // ──── 启动初始化：由引导页（InitializationView）调用，返回是否成功 ────
  let initPromise: Promise<boolean> | null = null
  async function init(): Promise<boolean> {
    if (!initPromise) {
      initPromise = fetchList().then(
        (ok) => {
          // 失败时重置，允许「重新初始化」再次重试
          if (!ok) initPromise = null
          return ok
        },
        () => {
          // fetchList 异常（reject）时同样释放 initPromise，避免重试永远返回已拒绝的 Promise
          initPromise = null
          return false
        }
      )
    }
    return initPromise
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
  // 职责单一：仅拉取消息数据，不修改 currentConversationId。
  // 当前选中会话由 selectConversation()（点击）/ reconcileSelection()（删除/初始化）控制，
  // 避免异步请求晚返回时用旧会话 id 覆盖最新选择。
  async function loadMessages(
    id: string,
    page = 1,
    limit = 50
  ): Promise<{ messages: ConversationMessage[]; total: number } | null> {
    messagesLoading.value = true
    try {
      const result = await getMessages(id, page, limit)
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
    init,
    create,
    remove,
    updateTitle,
    loadMessages,
    selectConversation,
    clearSelection,
    saveCurrentId
  }
})
