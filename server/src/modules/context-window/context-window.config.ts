/**
 * 模型上下文窗口配置
 * 后续可从环境变量或数据库读取
 */

export interface ModelContextConfig {
  maxContextTokens: number
  description: string
}

/** 模型名 → 上下文窗口上限（token） */
export const MODEL_CONTEXT_LIMITS: Record<string, ModelContextConfig> = {
  'gpt-4o': {
    maxContextTokens: 128000,
    description: 'GPT-4o (Omni)'
  },
  'gpt-4-turbo': {
    maxContextTokens: 128000,
    description: 'GPT-4 Turbo'
  },
  'gpt-4': {
    maxContextTokens: 8192,
    description: 'GPT-4'
  },
  'gpt-3.5-turbo': {
    maxContextTokens: 16385,
    description: 'GPT-3.5 Turbo'
  },
  'deepseek-chat': {
    maxContextTokens: 65536,
    description: 'DeepSeek-V3'
  },
  'deepseek-reasoner': {
    maxContextTokens: 65536,
    description: 'DeepSeek-R1'
  },
  'qwen-plus': {
    maxContextTokens: 131072,
    description: 'Qwen-Plus'
  },
  'qwen-max': {
    maxContextTokens: 32768,
    description: 'Qwen-Max'
  }
}

/** 默认上下文窗口 */
export const DEFAULT_CONTEXT_LIMIT = 128000

/** 输出预留 token 数（确保 LLM 有足够空间生成回复） */
export const OUTPUT_TOKEN_RESERVE = 4096

/**
 * 获取模型的上下文窗口上限
 * 未知模型返回默认值
 */
export function getModelContextLimit(model?: string): number {
  if (model && MODEL_CONTEXT_LIMITS[model]) {
    return MODEL_CONTEXT_LIMITS[model].maxContextTokens
  }
  // 尝试模糊匹配
  if (model) {
    for (const [key, config] of Object.entries(MODEL_CONTEXT_LIMITS)) {
      if (model.includes(key)) {
        return config.maxContextTokens
      }
    }
  }
  return DEFAULT_CONTEXT_LIMIT
}
