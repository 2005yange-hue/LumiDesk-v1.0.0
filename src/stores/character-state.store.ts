import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getCharacterState } from '@/services/character-state.api'
import type { CharacterState } from '@/types/character-state.types'

/** 当前活跃角色的运行态缓存。 */
export const useCharacterStateStore = defineStore('characterState', () => {
  const state = ref<CharacterState | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchState(characterId: string): Promise<void> {
    if (!characterId) {
      state.value = null
      return
    }

    loading.value = true
    error.value = null
    try {
      state.value = await getCharacterState(characterId)
    } catch (err) {
      state.value = null
      error.value = err instanceof Error ? err.message : '角色状态加载失败'
    } finally {
      loading.value = false
    }
  }

  return { state, loading, error, fetchState }
})
