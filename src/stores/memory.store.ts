import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  deleteMemory as deleteMemoryRequest,
  getMemories,
  updateMemory as updateMemoryRequest
} from '@/services/memory.api'
import type { MemoryEntry, UpdateMemoryRequest } from '@/types/memory.types'

export const useMemoryStore = defineStore('memory', () => {
  const memories = ref<MemoryEntry[]>([])
  const loading = ref(false)
  const error = ref('')
  const saving = ref(false)
  const deletingId = ref<number | null>(null)
  const currentCharacterId = ref('')

  async function fetchMemories(characterId: string): Promise<void> {
    if (!characterId) {
      memories.value = []
      currentCharacterId.value = ''
      return
    }

    loading.value = true
    error.value = ''
    currentCharacterId.value = characterId
    try {
      memories.value = await getMemories(characterId)
    } catch (requestError) {
      error.value = getErrorMessage(requestError, '记忆加载失败')
      memories.value = []
      throw requestError
    } finally {
      loading.value = false
    }
  }

  async function updateMemory(id: number, data: UpdateMemoryRequest): Promise<MemoryEntry> {
    saving.value = true
    error.value = ''
    try {
      const updated = await updateMemoryRequest(id, data)
      const index = memories.value.findIndex((memory) => memory.id === id)
      if (index >= 0) memories.value[index] = updated
      return updated
    } catch (requestError) {
      error.value = getErrorMessage(requestError, '记忆更新失败')
      throw requestError
    } finally {
      saving.value = false
    }
  }

  async function deleteMemory(id: number): Promise<void> {
    deletingId.value = id
    error.value = ''
    try {
      await deleteMemoryRequest(id)
      memories.value = memories.value.filter((memory) => memory.id !== id)
    } catch (requestError) {
      error.value = getErrorMessage(requestError, '记忆删除失败')
      throw requestError
    } finally {
      deletingId.value = null
    }
  }

  function getErrorMessage(requestError: unknown, fallback: string): string {
    if (requestError && typeof requestError === 'object' && 'response' in requestError) {
      const response = requestError.response as { data?: { message?: string } }
      if (response.data?.message) return response.data.message
    }
    return requestError instanceof Error ? requestError.message : fallback
  }

  return {
    memories,
    loading,
    error,
    saving,
    deletingId,
    currentCharacterId,
    fetchMemories,
    updateMemory,
    deleteMemory
  }
})
