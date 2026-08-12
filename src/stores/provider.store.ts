import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  ProviderInfo,
  CreateProviderData,
  TestConnectionResult,
  ModelInfo
} from '@/types/provider.types'
import {
  getProviders,
  getActiveProvider,
  createProvider as createProviderApi,
  updateProvider as updateProviderApi,
  deleteProvider as deleteProviderApi,
  testConnection as testConnectionApi,
  fetchModels as fetchModelsApi
} from '@/services/provider.api'

const STORAGE_KEY = 'ai-companion-provider'

/**
 * Provider 管理 Store
 * 管理 API 连接配置，与后端同步
 */
export const useProviderStore = defineStore('provider', () => {
  // ──── 状态 ────
  const providers = ref<ProviderInfo[]>([])
  const activeProviderId = ref<number | null>(loadActiveId())
  const loading = ref(false)
  const testResult = ref<TestConnectionResult | null>(null)
  const modelList = ref<ModelInfo[]>([])

  // ──── 持久化活跃 Provider ID ────
  function loadActiveId(): number | null {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? Number(stored) : null
  }

  function saveActiveId(id: number | null): void {
    activeProviderId.value = id
    if (id) {
      localStorage.setItem(STORAGE_KEY, String(id))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  // ──── 获取当前活跃 Provider ────
  const activeProvider = (): ProviderInfo | null => {
    if (!activeProviderId.value) return null
    return providers.value.find((p) => p.id === activeProviderId.value) || null
  }

  // ──── 加载 Provider 列表 ────
  async function fetchProviders(): Promise<void> {
    loading.value = true
    try {
      providers.value = await getProviders()

      // 同步活跃状态
      const enabled = providers.value.find((p) => p.enabled)
      if (enabled && activeProviderId.value !== enabled.id) {
        saveActiveId(enabled.id)
      }
    } catch {
      providers.value = []
    } finally {
      loading.value = false
    }
  }

  // ──── 创建 Provider ────
  async function createProvider(data: CreateProviderData): Promise<ProviderInfo | null> {
    try {
      const result = await createProviderApi(data)
      await fetchProviders()
      saveActiveId(result.id)
      return result
    } catch {
      return null
    }
  }

  // ──── 更新 Provider ────
  async function updateProvider(id: number, data: Partial<CreateProviderData>): Promise<ProviderInfo | null> {
    try {
      const result = await updateProviderApi(id, data)
      await fetchProviders()
      return result
    } catch {
      return null
    }
  }

  // ──── 删除 Provider ────
  async function removeProvider(id: number): Promise<boolean> {
    try {
      await deleteProviderApi(id)
      if (activeProviderId.value === id) {
        saveActiveId(null)
      }
      await fetchProviders()
      return true
    } catch {
      return false
    }
  }

  // ──── 切换活跃 Provider ────
  async function setActive(id: number): Promise<void> {
    await updateProviderApi(id, { enabled: true })
    saveActiveId(id)
    await fetchProviders()
  }

  // ──── 测试连接 ────
  async function testConnection(
    baseUrl: string,
    apiKey: string,
    model: string
  ): Promise<TestConnectionResult> {
    testResult.value = null
    try {
      const result = await testConnectionApi(baseUrl, apiKey, model)
      testResult.value = result
      return result
    } catch (error) {
      const err = { success: false, latency: 0, error: String(error) }
      testResult.value = err
      return err
    }
  }

  // ──── 获取模型列表 ────
  async function fetchModelList(baseUrl: string, apiKey: string): Promise<ModelInfo[]> {
    modelList.value = []
    try {
      const result = await fetchModelsApi(baseUrl, apiKey)
      modelList.value = result
      return result
    } catch {
      return []
    }
  }

  /** 刷新 Provider 状态（聊天的页面切换时调用） */
  async function refreshActive(): Promise<void> {
    try {
      const active = await getActiveProvider()
      if (active) {
        saveActiveId(active.id)
        if (!providers.value.find((p) => p.id === active.id)) {
          providers.value = [active, ...providers.value]
        }
      }
    } catch {
      // 静默处理
    }
  }

  return {
    providers,
    activeProviderId,
    loading,
    testResult,
    modelList,
    activeProvider,
    fetchProviders,
    createProvider,
    updateProvider,
    removeProvider,
    setActive,
    testConnection,
    fetchModelList,
    refreshActive,
    saveActiveId
  }
})
