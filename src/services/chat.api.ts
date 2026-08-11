import type { ChatStreamChunk, SendMessageRequest, HistoryMessage } from '@/types/chat.types'
import type { ModelSettings } from '@/types/settings.types'

const API_BASE = '/api'

/**
 * 发送消息 - SSE 流式响应
 * 支持 AbortController 取消请求
 */
export async function sendMessageStream(
  request: SendMessageRequest,
  modelConfig: ModelSettings,
  characterId: string,
  onChunk: (chunk: ChatStreamChunk) => void,
  onError: (error: string) => void,
  onComplete: (messageId: string) => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    const body: Record<string, unknown> = {
      content: request.content,
      history: request.history,
      modelConfig: {
        apiKey: modelConfig.apiKey,
        apiBaseUrl: modelConfig.apiBaseUrl,
        model: modelConfig.model,
        temperature: modelConfig.temperature,
        maxTokens: modelConfig.maxTokens
      }
    }

    // 如果选择了角色，传入 characterId
    if (characterId) {
      body.characterId = characterId
    }

    const response = await fetch(`${API_BASE}/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      onError(`请求失败 (${response.status}): ${errorText}`)
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      onError('浏览器不支持流式读取')
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      // 检查是否被取消
      if (signal?.aborted) {
        reader.cancel()
        return
      }

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data: ChatStreamChunk = JSON.parse(line.slice(6))
            if (data.error) {
              onError(data.error)
              return
            }
            onChunk(data)
            if (data.done && data.id) {
              onComplete(data.id)
              return
            }
          } catch {
            // JSON 解析失败，忽略
          }
        }
      }
    }
  } catch (error) {
    // 忽略 AbortError
    if (error instanceof DOMException && error.name === 'AbortError') {
      return
    }
    const msg = error instanceof Error ? error.message : '网络异常'
    onError(msg)
  }
}

/**
 * 创建可取消的 abort controller 包装
 * 返回 controller 供外部调用 abort()
 */
export function createAbortController(): AbortController {
  return new AbortController()
}
