import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  clearCharacterEmotions,
  deleteEmotionRecord,
  getEmotionPreference,
  getEmotionRecords,
  getEmotionSummary,
  updateEmotionPreference,
  updateEmotionRecord
} from '@/services/emotion.api'
import type { EmotionPreference, EmotionRecord, EmotionSummary, UpdateEmotionRecordPayload } from '@/types/emotion.types'

export const useEmotionStore = defineStore('emotion', () => {
  const records = ref<EmotionRecord[]>([])
  const summary = ref<EmotionSummary | null>(null)
  const preference = ref<EmotionPreference | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const total = ref(0)
  const activeCharacterId = ref('')

  const enabled = computed(() => preference.value?.enabled ?? true)

  async function fetchPreference(): Promise<void> {
    preference.value = await getEmotionPreference()
  }

  async function setEnabled(value: boolean): Promise<void> {
    saving.value = true
    try {
      preference.value = await updateEmotionPreference(value)
    } finally {
      saving.value = false
    }
  }

  async function fetchEmotionData(characterId: string, days = 30): Promise<void> {
    if (!characterId) {
      records.value = []
      summary.value = null
      total.value = 0
      return
    }
    const requestCharacterId = characterId
    activeCharacterId.value = characterId
    loading.value = true
    error.value = null
    try {
      const from = new Date(Date.now() - days * 86_400_000).toISOString()
      const [page, nextSummary] = await Promise.all([
        getEmotionRecords(characterId, { from, page: 1, limit: 100 }),
        getEmotionSummary(characterId)
      ])
      if (activeCharacterId.value !== requestCharacterId) return
      records.value = page.records
      total.value = page.total
      summary.value = nextSummary
    } catch (err) {
      if (activeCharacterId.value !== requestCharacterId) return
      records.value = []
      summary.value = null
      total.value = 0
      error.value = err instanceof Error ? err.message : '情绪记录加载失败'
      throw err
    } finally {
      if (activeCharacterId.value === requestCharacterId) loading.value = false
    }
  }

  async function editRecord(id: number, payload: UpdateEmotionRecordPayload): Promise<EmotionRecord> {
    saving.value = true
    try {
      const updated = await updateEmotionRecord(id, payload)
      const index = records.value.findIndex((record) => record.id === id)
      if (index >= 0) records.value[index] = updated
      return updated
    } finally {
      saving.value = false
    }
  }

  async function removeRecord(id: number): Promise<void> {
    saving.value = true
    try {
      await deleteEmotionRecord(id)
      records.value = records.value.filter((record) => record.id !== id)
      total.value = Math.max(0, total.value - 1)
      if (activeCharacterId.value) summary.value = await getEmotionSummary(activeCharacterId.value)
    } finally {
      saving.value = false
    }
  }

  async function clearRecords(characterId: string): Promise<void> {
    saving.value = true
    try {
      await clearCharacterEmotions(characterId)
      if (activeCharacterId.value === characterId) {
        records.value = []
        total.value = 0
        summary.value = await getEmotionSummary(characterId)
      }
    } finally {
      saving.value = false
    }
  }

  return {
    records,
    summary,
    preference,
    loading,
    saving,
    error,
    total,
    activeCharacterId,
    enabled,
    fetchPreference,
    setEnabled,
    fetchEmotionData,
    editRecord,
    removeRecord,
    clearRecords
  }
})