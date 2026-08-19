import axios from 'axios'
import type {
  EmotionPreference,
  EmotionRecord,
  EmotionRecordPage,
  EmotionSummary,
  UpdateEmotionRecordPayload
} from '@/types/emotion.types'

interface Wrapped<T> {
  success: boolean
  data: T
  message: string
  timestamp: string
}

export async function getEmotionPreference(): Promise<EmotionPreference> {
  const response = await axios.get<Wrapped<EmotionPreference>>('/api/emotion-preferences')
  return response.data.data
}

export async function updateEmotionPreference(enabled: boolean): Promise<EmotionPreference> {
  const response = await axios.patch<Wrapped<EmotionPreference>>('/api/emotion-preferences', { enabled })
  return response.data.data
}

export async function getEmotionRecords(
  characterId: string,
  params: { from?: string; to?: string; page?: number; limit?: number } = {}
): Promise<EmotionRecordPage> {
  const response = await axios.get<Wrapped<EmotionRecordPage>>(`/api/emotions/characters/${characterId}`, { params })
  return response.data.data
}

export async function getEmotionSummary(characterId: string): Promise<EmotionSummary> {
  const response = await axios.get<Wrapped<EmotionSummary>>(`/api/emotions/characters/${characterId}/summary`)
  return response.data.data
}

export async function updateEmotionRecord(id: number, payload: UpdateEmotionRecordPayload): Promise<EmotionRecord> {
  const response = await axios.patch<Wrapped<EmotionRecord>>(`/api/emotions/${id}`, payload)
  return response.data.data
}

export async function deleteEmotionRecord(id: number): Promise<void> {
  await axios.delete(`/api/emotions/${id}`)
}

export async function clearCharacterEmotions(characterId: string): Promise<void> {
  await axios.delete(`/api/emotions/characters/${characterId}`)
}