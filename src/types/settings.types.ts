/** 模型配置 */
export interface ModelSettings {
  /** API Base URL（OpenAI 兼容） */
  apiBaseUrl: string
  /** API Key */
  apiKey: string
  /** 模型名称 */
  model: string
  /** 生成温度 (0-2) */
  temperature: number
  /** 最大 Token 数 */
  maxTokens: number
}

/** 预设模型列表（快捷切换） */
export interface ModelPreset {
  label: string
  model: string
  baseUrl: string
  provider: string
}

/** 常用模型预设 */
export const MODEL_PRESETS: ModelPreset[] = [
  { label: 'GPT-4o', model: 'gpt-4o', baseUrl: 'https://api.openai.com/v1', provider: 'openai' },
  { label: 'GPT-4o-mini', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', provider: 'openai' },
  { label: 'DeepSeek-Chat', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1', provider: 'deepseek' },
  { label: 'Qwen-Plus', model: 'qwen-plus', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', provider: 'qwen' },
  { label: 'Claude 3.5 Sonnet', model: 'claude-3-5-sonnet-20241022', baseUrl: 'https://api.anthropic.com/v1', provider: 'claude' }
]

/** 默认模型配置 */
export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  apiBaseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 1024
}
