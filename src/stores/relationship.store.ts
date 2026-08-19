import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRelationshipProfile } from '@/services/relationship.api'
import type { RelationshipProfile } from '@/types/relationship.types'

export const useRelationshipStore = defineStore('relationship', () => {
  const profile = ref<RelationshipProfile | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchProfile(characterId: string): Promise<void> {
    if (!characterId) {
      profile.value = null
      return
    }
    loading.value = true
    error.value = null
    try {
      profile.value = await getRelationshipProfile(characterId)
    } catch (errorValue) {
      profile.value = null
      error.value = errorValue instanceof Error ? errorValue.message : '关系成长记录加载失败'
    } finally {
      loading.value = false
    }
  }

  return { profile, loading, error, fetchProfile }
})
