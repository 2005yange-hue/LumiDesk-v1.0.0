import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatMessage, HistoryMessage } from '@/types/chat.types'
import { sendMessageStream } from '@/services/chat.api'
import { useSettingsStore } from './settings.store'
import { useProviderStore } from './provider.store'

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)
  const currentStreamContent = ref('')
  const error = ref<string | null>(null)

  /** 当前请求的 AbortController */
  let abortController: AbortController | null = null

  function getHistory(): HistoryMessage[] {
    return messages.value.slice(-20).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }))
  }

  function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  async function sendMessage(content: string): Promise<void> {
    if (!content.trim() || isStreaming.value) return

    error.value = null

    // 创建新的 AbortController
    abortController = new AbortController()

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString()
    }
    messages.value.push(userMessage)

    // 添加 AI 消息占位
    const aiMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString()
    }
    messages.value.push(aiMessage)

    isStreaming.value = true
    currentStreamContent.value = ''

    // 获取模型配置：Provider > Settings Store > .env
    const settingsStore = useSettingsStore()
    const providerStore = useProviderStore()
    const activeProvider = providerStore.activeProvider()
    const modelConfig = activeProvider
      ? {
          providerId: activeProvider.id,
          model: activeProvider.model,
          temperature: settingsStore.modelSettings.temperature,
          maxTokens: settingsStore.modelSettings.maxTokens
        }
      : {
          model: settingsStore.modelSettings.model,
          temperature: settingsStore.modelSettings.temperature,
          maxTokens: settingsStore.modelSettings.maxTokens
        }

    const characterId = settingsStore.activeCharacterId

    await sendMessageStream(
      { content: content.trim(), history: getHistory() },
      modelConfig,
      characterId,
      (chunk) => {
        if (chunk.fullContent !== undefined) {
          currentStreamContent.value = chunk.fullContent
          const lastMsg = messages.value[messages.value.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = chunk.fullContent
          }
        }
      },
      (errMsg) => {
        error.value = errMsg
        const lastMsg = messages.value[messages.value.length - 1]
        if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content) {
          messages.value.pop()
        }
      },
      (messageId) => {
        const lastMsg = messages.value[messages.value.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.id = messageId
          lastMsg.timestamp = new Date().toISOString()
        }
      },
      abortController.signal
    )

    isStreaming.value = false
    abortController = null
  }

  /** 停止当前生成 */
  function stopGeneration(): void {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    isStreaming.value = false
  }

  function clearMessages(): void {
    // 如果正在流式输出，先取消
    stopGeneration()
    messages.value = []
    error.value = null
  }

  return {
    messages,
    isStreaming,
    currentStreamContent,
    error,
    sendMessage,
    stopGeneration,
    clearMessages
  }
})
