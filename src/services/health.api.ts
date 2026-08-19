import axios from 'axios'

const BASE = '/api/health'

/** 后端统一响应包装（ResponseInterceptor） */
interface Wrapped<T> {
  success: boolean
  data: T
  message: string
  timestamp: string
}

export interface HealthInfo {
  status: string
  timestamp: string
  version: string
}

/**
 * 后端健康检查
 * 返回 true 表示后端已就绪，可用于初始化引导页的门控
 */
export async function checkHealth(): Promise<boolean> {
  const { data } = await axios.get<Wrapped<HealthInfo>>(BASE)
  return data.success === true && data.data?.status === 'ok'
}
