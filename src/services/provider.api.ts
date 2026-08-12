import axios from 'axios'
import type {
  ProviderInfo,
  CreateProviderData,
  TestConnectionResult,
  ModelInfo
} from '@/types/provider.types'

const BASE = '/api/provider'

/** 获取所有 Provider */
export async function getProviders(): Promise<ProviderInfo[]> {
  const { data } = await axios.get(BASE)
  return data.data
}

/** 获取当前启用的 Provider */
export async function getActiveProvider(): Promise<ProviderInfo | null> {
  const { data } = await axios.get(`${BASE}/active`)
  return data.data
}

/** 创建 Provider */
export async function createProvider(dto: CreateProviderData): Promise<ProviderInfo> {
  const { data } = await axios.post(BASE, dto)
  return data.data
}

/** 更新 Provider */
export async function updateProvider(id: number, dto: Partial<CreateProviderData>): Promise<ProviderInfo> {
  const { data } = await axios.put(`${BASE}/${id}`, dto)
  return data.data
}

/** 删除 Provider */
export async function deleteProvider(id: number): Promise<void> {
  await axios.delete(`${BASE}/${id}`)
}

/** 测试 API 连接 */
export async function testConnection(
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<TestConnectionResult> {
  const { data } = await axios.post(`${BASE}/test`, {
    base_url: baseUrl,
    api_key: apiKey,
    model
  })
  return data
}

/** 获取 API 模型列表 */
export async function fetchModels(
  baseUrl: string,
  apiKey: string
): Promise<ModelInfo[]> {
  const { data } = await axios.post(`${BASE}/models`, {
    base_url: baseUrl,
    api_key: apiKey
  })
  return data
}
