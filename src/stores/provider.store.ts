import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import type {
  ProviderInfo,
  CreateProviderData,
  TestConnectionResult,
  ModelInfo,
  SavedModel,
  ProviderConnectionStatus
} from '@/types/provider.types'
import {
  getProviders,
  getActiveProvider,
  getDefaultProvider,
  createProvider as createProviderApi,
  updateProvider as updateProviderApi,
  deleteProvider as deleteProviderApi,
  testConnection as testConnectionApi,
  fetchModels as fetchModelsApi,
  getProviderModels,
  getSavedModels,
  addProviderModel,
  removeProviderModel
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
  /** 各 Provider 连接状态缓存 */
  const connectionStatus = reactive<Record<number, ProviderConnectionStatus>>({})

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

  // ──── 获取指定 Provider 的连接状态 ────
  function getConnectionStatus(providerId: number): ProviderConnectionStatus | undefined {
    return connectionStatus[providerId]
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

  // ──── 测试 Provider 连接（通过 ID，从对话框表单） ────
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
      const err = { success: false, latency: 0, model, message: String(error) }
      testResult.value = err
      return err
    }
  }

  // ──── 测试已有 Provider 的连接状态 ────
  async function testProviderConnection(providerId: number): Promise<void> {
    const provider = providers.value.find((p) => p.id === providerId)
    if (!provider) return

    // NOTE: 前端不持有完整 api_key（脱敏），因此无法直接测试
    // 此处标记为需要后端支持，或记录状态
    connectionStatus[providerId] = {
      providerId,
      tested: false,
      success: false,
      latency: 0,
      message: '需要后端支持完整 API Key 测试'
    }
  }

  // ──── 获取模型列表（新建对话框用） ────
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

  // ──── 通过 Provider ID 获取模型列表 ────
  async function fetchModelsByProviderId(providerId: number): Promise<ModelInfo[]> {
    modelList.value = []
    try {
      const result = await getProviderModels(providerId)
      modelList.value = result
      return result
    } catch {
      return []
    }
  }

  /** 获取 Provider 的本地保存模型 */
  async function fetchSavedModels(providerId: number): Promise<SavedModel[]> {
    try {
      return await getSavedModels(providerId)
    } catch {
      return []
    }
  }

  /** 添加模型到 Provider */
  async function addModel(providerId: number, modelName: string): Promise<SavedModel | null> {
    try {
      return await addProviderModel(providerId, modelName)
    } catch {
      return null
    }
  }

  /** 删除 Provider 模型 */
  async function deleteModel(modelId: number): Promise<boolean> {
    try {
      await removeProviderModel(modelId)
      return true
    } catch {
      return false
    }
  }

  /** 刷新 Provider 状态（聊天页面切换时调用） */
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
    connectionStatus,
    activeProvider,
    getConnectionStatus,
    fetchProviders,
    createProvider,
    updateProvider,
    removeProvider,
    setActive,
    testConnection,
    testProviderConnection,
    fetchModelList,
    fetchModelsByProviderId,
    fetchSavedModels,
    addModel,
    deleteModel,
    refreshActive,
    saveActiveId
  }
})
