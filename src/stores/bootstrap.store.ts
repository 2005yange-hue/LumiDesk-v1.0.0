import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { checkHealth } from '@/services/health.api'
import { useConversationStore } from './conversation.store'
import { useProviderStore } from './provider.store'
import { useCharacterStore } from './character.store'

export type BootstrapStatus = 'idle' | 'running' | 'success' | 'error'
export type BootstrapTaskStatus = 'pending' | 'running' | 'success' | 'error'

export interface BootstrapTask {
  id: string
  label: string
  status: BootstrapTaskStatus
  error?: string
}

/** 初始化任务清单（顺序执行） */
const TASK_DEFINITIONS: Array<{ id: string; label: string }> = [
  { id: 'health', label: '后端健康检查' },
  { id: 'conversation', label: '会话数据加载' },
  { id: 'character', label: '角色数据加载' },
  { id: 'provider', label: '模型配置加载' }
]

/**
 * 应用启动引导状态机
 * 启动后由 InitializationView 调用 run() 顺序执行全部初始化任务，
 * 全部成功后方可进入 ChatView；任一失败则停在错误状态并提供重试。
 */
export const useBootstrapStore = defineStore('bootstrap', () => {
  const status = ref<BootstrapStatus>('idle')
  const tasks = ref<BootstrapTask[]>([])
  const errorMessage = ref('')
  const currentTaskId = ref<string | null>(null)

  const completedCount = computed(() =>
    tasks.value.filter((t) => t.status === 'success').length
  )

  const progress = computed(() => {
    if (tasks.value.length === 0) return 0
    return Math.round((completedCount.value / tasks.value.length) * 100)
  })

  function resetTasks(): void {
    tasks.value = TASK_DEFINITIONS.map((t) => ({
      ...t,
      status: 'pending' as BootstrapTaskStatus
    }))
    errorMessage.value = ''
    currentTaskId.value = null
  }

  async function run(): Promise<boolean> {
    // 防止重复触发（初始化页 onMounted 与用户点击重试并发时）
    if (status.value === 'running') return false

    resetTasks()
    status.value = 'running'

    const conversationStore = useConversationStore()
    const providerStore = useProviderStore()
    const characterStore = useCharacterStore()

    for (const task of tasks.value) {
      currentTaskId.value = task.id
      task.status = 'running'

      try {
        switch (task.id) {
          case 'health': {
            const ok = await checkHealth()
            if (!ok) throw new Error('后端服务无响应')
            break
          }
          case 'conversation': {
            const ok = await conversationStore.init()
            if (!ok) throw new Error('会话列表加载失败')
            break
          }
          case 'character': {
            await characterStore.fetchCharacters()
            break
          }
          case 'provider': {
            const listOk = await providerStore.fetchProviders()
            const activeOk = await providerStore.refreshActive()
            if (!listOk || !activeOk) throw new Error('模型配置加载失败')
            break
          }
        }

        task.status = 'success'
        task.error = undefined
      } catch (err) {
        task.status = 'error'
        task.error = err instanceof Error ? err.message : String(err)
        errorMessage.value = task.error
        status.value = 'error'
        return false
      }
    }

    currentTaskId.value = null
    status.value = 'success'
    return true
  }

  return {
    status,
    tasks,
    errorMessage,
    currentTaskId,
    completedCount,
    progress,
    run
  }
})
