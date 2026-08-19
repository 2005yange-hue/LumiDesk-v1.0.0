import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatMessage, HistoryMessage } from '@/types/chat.types'
import { sendMessageStream } from '@/services/chat.api'
import { deleteFromMessage, prepareMessageEdit, prepareMessageRegenerate } from '@/services/conversation.api'
import { useSettingsStore } from './settings.store'
import { useProviderStore } from './provider.store'
import { useConversationStore } from './conversation.store'
import { petEventBus } from '@/live2d/pet-event-bus'
import { inferPetEmotion } from '@/live2d/pet-emotion-signal'

const PAGE_SIZE = 50

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)
  const currentStreamContent = ref('')
  const error = ref<string | null>(null)
  const loadingOlder = ref(false)
  const hasMoreHistory = ref(false)
  const chatCompleteVersion = ref(0)
  let currentPage = 1
  let abortController: AbortController | null = null

  function getHistory(): HistoryMessage[] { return messages.value.slice(-20).map((message) => ({ role: message.role as 'user' | 'assistant', content: message.content })) }
  function generateId(): string { return Date.now() + '-' + Math.random().toString(36).slice(2, 9) }

  async function sendMessage(content: string): Promise<void> {
    if (!content.trim() || isStreaming.value) return
    error.value = null
    const history = getHistory()
    abortController = new AbortController()
    messages.value.push({ id: generateId(), role: 'user', content: content.trim(), timestamp: new Date().toISOString() })
    messages.value.push({ id: generateId(), role: 'assistant', content: '', timestamp: new Date().toISOString() })
    isStreaming.value = true
    currentStreamContent.value = ''
    const settingsStore = useSettingsStore()
    const providerStore = useProviderStore()
    const conversationStore = useConversationStore()
    const activeProvider = providerStore.activeProvider()
    const modelConfig = activeProvider ? { providerId: activeProvider.id, model: activeProvider.model, temperature: settingsStore.modelSettings.temperature, maxTokens: settingsStore.modelSettings.maxTokens } : { model: settingsStore.modelSettings.model, temperature: settingsStore.modelSettings.temperature, maxTokens: settingsStore.modelSettings.maxTokens }
    const characterId = settingsStore.activeCharacterId
    let streamFailed = false
    const emotionSignal = inferPetEmotion(content.trim())
    petEventBus.publish({ type: 'emotion_change', payload: { characterId, emotion: emotionSignal.emotion, intensity: emotionSignal.intensity } })
    petEventBus.publish({ type: 'chat_phase', payload: { characterId, phase: 'listening' } })
    petEventBus.publish({ type: 'chat_phase', payload: { characterId, phase: 'waiting' } })
    petEventBus.publish({ type: 'chat_start', payload: { characterId } })
    try {
      await sendMessageStream({ content: content.trim(), history }, modelConfig, characterId, conversationStore.currentConversationId, (chunk) => {
        if (chunk.fullContent !== undefined) {
          currentStreamContent.value = chunk.fullContent
          const last = messages.value[messages.value.length - 1]
          if (last?.role === 'assistant') last.content = chunk.fullContent
          petEventBus.publish({ type: 'chat_delta', payload: { characterId, content: chunk.fullContent } })
        }
      }, (message) => {
        streamFailed = true
        error.value = message
        const last = messages.value[messages.value.length - 1]
        if (last?.role === 'assistant' && !last.content) messages.value.pop()
        petEventBus.publish({ type: 'chat_error', payload: { characterId } })
      }, (id) => {
        const last = messages.value[messages.value.length - 1]
        if (last?.role === 'assistant') { last.id = id; last.timestamp = new Date().toISOString() }
      }, abortController.signal)
      if (!streamFailed) { chatCompleteVersion.value += 1; petEventBus.publish({ type: 'chat_complete', payload: { characterId } }) }
    } catch (err) {
      if (!streamFailed) {
        error.value = err instanceof Error ? err.message : '聊天请求失败'
        const last = messages.value[messages.value.length - 1]
        if (last?.role === 'assistant' && !last.content) messages.value.pop()
        petEventBus.publish({ type: 'chat_error', payload: { characterId } })
      }
    } finally {
      isStreaming.value = false
      abortController = null
    }
  }

  function stopGeneration(): void { if (abortController) abortController.abort(); abortController = null; isStreaming.value = false }
  function clearMessages(): void { stopGeneration(); messages.value = []; error.value = null; hasMoreHistory.value = false; currentPage = 1 }
  function setMessages(list: ChatMessage[]): void { stopGeneration(); messages.value = list; error.value = null }

  let loadRequestId = 0
  async function loadConversation(conversationId: string): Promise<void> {
    const requestId = ++loadRequestId
    currentPage = 1
    const result = await useConversationStore().loadMessages(conversationId, currentPage, PAGE_SIZE)
    if (requestId !== loadRequestId || !result) return
    setMessages(toChatMessages(result.messages))
    hasMoreHistory.value = messages.value.length < result.total
  }

  async function loadOlder(conversationId: string): Promise<void> {
    if (loadingOlder.value || !hasMoreHistory.value) return
    loadingOlder.value = true
    try {
      const nextPage = currentPage + 1
      const result = await useConversationStore().loadMessages(conversationId, nextPage, PAGE_SIZE)
      if (!result) return
      const older = toChatMessages(result.messages)
      const ids = new Set(messages.value.map((message) => message.id))
      messages.value = [...older.filter((message) => !ids.has(message.id)), ...messages.value]
      currentPage = nextPage
      hasMoreHistory.value = messages.value.length < result.total
    } finally { loadingOlder.value = false }
  }

  async function editAndResend(conversationId: string, messageId: string, content: string): Promise<void> {
    if (isStreaming.value) return
    const result = await prepareMessageEdit(conversationId, messageId, content)
    messages.value = messages.value.slice(0, result.remainingCount)
    currentPage = 1
    hasMoreHistory.value = false
    await sendMessage(result.content)
  }

  async function regenerate(conversationId: string, messageId: string): Promise<void> {
    if (isStreaming.value) return
    const result = await prepareMessageRegenerate(conversationId, messageId)
    messages.value = messages.value.slice(0, result.remainingCount)
    currentPage = 1
    hasMoreHistory.value = false
    await sendMessage(result.content)
  }

  async function deleteTail(conversationId: string, messageId: string): Promise<void> {
    if (isStreaming.value) return
    const result = await deleteFromMessage(conversationId, messageId)
    messages.value = messages.value.slice(0, result.remainingCount)
    currentPage = 1
    hasMoreHistory.value = false
  }

  function toChatMessages(list: Array<{ id: string; role: string; content: string; created_at: string }>): ChatMessage[] { return list.map((message) => ({ id: message.id, role: message.role as 'user' | 'assistant', content: message.content, timestamp: message.created_at })) }

  return { messages, isStreaming, currentStreamContent, error, loadingOlder, hasMoreHistory, chatCompleteVersion, sendMessage, stopGeneration, clearMessages, setMessages, loadConversation, loadOlder, editAndResend, regenerate, deleteTail }
})

