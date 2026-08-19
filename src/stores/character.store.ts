import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CharacterData } from '@/types/character.types'
import { getCharacters } from '@/services/character.api'

/**
 * 角色数据 Store
 * 缓存角色列表，供初始化引导页预加载与 ChatView 复用，避免重复请求
 */
export const useCharacterStore = defineStore('character', () => {
  const characters = ref<CharacterData[]>([])
  const loading = ref(false)

  /** 是否已成功加载过角色列表（用于缓存，避免重复请求） */
  let loaded = false

  /**
   * 加载角色列表（单一数据源缓存）
   * @param force 为 true 时忽略缓存强制刷新（Settings 增删改角色后调用）
   * 首次加载成功后缓存；后续非 force 调用直接复用缓存，避免重复请求。
   * 失败时保留旧数据并抛出异常，loaded 状态不变，便于下次重试。
   */
  async function fetchCharacters(force = false): Promise<void> {
    if (loaded && !force) return
    loading.value = true
    try {
      characters.value = await getCharacters()
      loaded = true
    } finally {
      loading.value = false
    }
  }

  return {
    characters,
    loading,
    fetchCharacters
  }
})
