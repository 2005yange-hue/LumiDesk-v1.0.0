export const EMOTION_TYPES = ['happy', 'calm', 'anxious', 'sad', 'angry', 'tired'] as const
export type EmotionType = (typeof EMOTION_TYPES)[number]
export type EmotionSource = 'rule' | 'llm' | 'manual'

export interface EmotionRecord {
  id: number
  user_id: string
  character_id: string
  conversation_id: string | null
  user_message_id: string
  emotion: EmotionType
  intensity: number
  confidence: number
  source: EmotionSource
  reason: string | null
  occurred_at: string
  created_at: string
  updated_at: string
}

export interface EmotionPreference {
  id: number
  user_id: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface EmotionSummary {
  primaryEmotion: EmotionType | null
  averageIntensity: number
  recentCount: number
  distribution: Record<EmotionType, number>
}

export interface EmotionRecordPage {
  records: EmotionRecord[]
  total: number
  page: number
  limit: number
}

export interface UpdateEmotionRecordPayload {
  emotion: EmotionType
  intensity: number
  reason?: string
}

export const EMOTION_LABELS: Record<EmotionType, string> = {
  happy: '愉快',
  calm: '平静',
  anxious: '焦虑',
  sad: '低落',
  angry: '烦躁',
  tired: '疲惫'
}

export const EMOTION_ICONS: Record<EmotionType, string> = {
  happy: '😊',
  calm: '😌',
  anxious: '😟',
  sad: '😔',
  angry: '😠',
  tired: '😫'
}

export const EMOTION_SOURCE_LABELS: Record<EmotionSource, string> = {
  rule: '规则识别',
  llm: '模型识别',
  manual: '已修正'
}