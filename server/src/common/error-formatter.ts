/**
 * LLM API 错误信息格式化工具
 * 将原始错误对象映射为用户可读的中文提示
 */

export function formatLLMError(error: unknown): string {
  if (error instanceof Error) {
    const err = error as Error & { status?: number; code?: string }

    if (err.status === 401 || err.code === 'invalid_api_key') {
      return 'API Key 无效，请检查您的 LLM_API_KEY 配置'
    }
    if (err.status === 429 || err.code === 'insufficient_quota') {
      return 'API 配额不足，请检查您的账户余额'
    }
    if (err.code === 'ECONNREFUSED' || err.message?.includes('timeout')) {
      return '无法连接到模型服务，请检查网络或 BASE_URL 配置'
    }
    if (err.message?.includes('context_length_exceeded')) {
      return '对话内容过长，请简化您的问题或清空历史记录'
    }
    return err.message || '未知错误，请稍后重试'
  }
  return '服务异常，请稍后重试'
}
