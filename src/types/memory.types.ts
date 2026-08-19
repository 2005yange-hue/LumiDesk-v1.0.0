export const MEMORY_TYPE_LABELS = {
  relationship: '关系记忆',
  preference: '偏好',
  personality: '性格',
  event: '事件',
  fact: '事实'
} as const

export const MEMORY_TYPE_ICONS = {
  relationship: '❤️',
  preference: '☕',
  personality: '✨',
  event: '📅',
  fact: '📌'
} as const

export type MemoryType = keyof typeof MEMORY_TYPE_LABELS
export type StoredMemoryType = MemoryType | 'personal'
export type VectorSyncStatus = 'pending' | 'synced' | 'failed'
export type MemoryStatus = 'active' | 'superseded' | 'archived'

export const MEMORY_STATUS_LABELS: Record<MemoryStatus, string> = {
  active: '当前记忆',
  superseded: '已被替代',
  archived: '已归档'
}

export interface MemoryEntry {
  id: number
  user_id: string
  character_id: string | null
  vector_id: string | null
  type: StoredMemoryType
  content: string
  importance: number
  confidence: number
  status: MemoryStatus
  replacement_memory_id: number | null
  usage_count: number
  memory_score: number
  last_used_at: string | null
  last_decay_at: string | null
  created_at: string
  updated_at: string
  vector_sync_status: VectorSyncStatus
  vector_sync_error: string | null
}

export interface UpdateMemoryRequest {
  type?: MemoryType
  content?: string
  importance?: number
}
