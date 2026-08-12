/** API Provider 配置 */
export interface ProviderInfo {
  id: number
  user_id: string
  name: string
  provider: string
  provider_type: string
  base_url: string
  api_key: string
  model: string
  enabled: boolean
  is_default: boolean
  temperature: number
  max_tokens: number
  top_p: number
  stream: boolean
  timeout: number
  custom_headers: string | null
  custom_body: string | null
  created_at: string
  updated_at: string
}

/** 创建/编辑 Provider 参数 */
export interface CreateProviderData {
  name: string
  provider: string
  provider_type?: string
  base_url: string
  api_key: string
  model: string
  enabled?: boolean
  is_default?: boolean
  temperature?: number
  max_tokens?: number
  top_p?: number
  stream?: boolean
  timeout?: number
  custom_headers?: string | null
  custom_body?: string | null
}

/** 连接测试结果 */
export interface TestConnectionResult {
  success: boolean
  latency: number
  model: string
  message?: string
  response?: string
  tokens?: number
}

/** 本地保存的 Provider 模型 */
export interface SavedModel {
  id: number
  provider_id: number
  model_name: string
  enabled: boolean
  created_at: string
}

/** 每个 Provider 的连接状态缓存 */
export interface ProviderConnectionStatus {
  providerId: number
  tested: boolean
  success: boolean
  latency: number
  message?: string
}

/** API 模型信息（远程获取） */
export interface ModelInfo {
  id: string
  owned_by: string
}

/** Provider 类型标签映射 */
export const PROVIDER_TYPE_LABELS: Record<string, string> = {
  'openai': 'OpenAI',
  'openai-compatible': 'OpenAI 兼容',
  'deepseek': 'DeepSeek',
  'gemini': 'Gemini',
  'claude': 'Claude',
  'openrouter': 'OpenRouter'
}

/** 预设 Provider 模板 */
export const PROVIDER_PRESETS: Array<{
  label: string
  provider: string
  providerType: string
  baseUrl: string
  defaultModel: string
}> = [
  { label: 'OpenAI', provider: 'openai', providerType: 'openai', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  { label: 'DeepSeek', provider: 'deepseek', providerType: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  { label: 'SiliconFlow', provider: 'siliconflow', providerType: 'openai-compatible', baseUrl: 'https://api.siliconflow.cn/v1', defaultModel: 'Qwen/Qwen2.5-7B-Instruct' },
  { label: 'Gemini (兼容)', provider: 'google', providerType: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.0-flash' },
  { label: 'OpenRouter', provider: 'openrouter', providerType: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-4o' },
  { label: '自定义', provider: 'openai-compatible', providerType: 'openai-compatible', baseUrl: '', defaultModel: '' }
]
