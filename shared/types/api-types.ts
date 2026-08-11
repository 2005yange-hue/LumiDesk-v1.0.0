// 共享 API 类型定义 - 前后端共用
// 后续阶段逐步扩展

// ──── 通用响应 ────

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  timestamp: string
}

export interface PaginationDto {
  page: number
  pageSize: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
